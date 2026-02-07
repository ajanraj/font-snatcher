import { load } from "cheerio";
import {
  EXTRACTION_TIMEOUT_MS,
  MAX_CSS_BYTES,
  MAX_HTML_BYTES,
  MAX_IMPORT_DEPTH,
  MAX_STYLESHEETS,
} from "@/server/font-extractor/constants";
import type { ExtractedFontSource } from "@/features/font-snatcher/types";
import { parseCssForFonts } from "@/server/font-extractor/css-extractor";
import { assertSafeTargetUrl } from "@/server/font-extractor/ssrf";
import { detectFontFormat } from "@/server/font-extractor/url-utils";

interface ExtractionStats {
  stylesheetCount: number;
  fontFaceCount: number;
  uniqueFontCount: number;
}

interface RawExtractionResult {
  referer: string;
  warnings: string[];
  stats: ExtractionStats;
  fonts: ExtractedFontSource[];
}

interface CrawlContext {
  queuedStylesheets: Array<{ url: string; depth: number }>;
  visitedStylesheets: Set<string>;
  warnings: string[];
  extractedFonts: ExtractedFontSource[];
  stylesheetCount: number;
  fontFaceCount: number;
}

const BASE_REQUEST_HEADERS = {
  "user-agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) FontSnatcher/1.0 Safari/537.36",
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
};

interface ReadTextOptions {
  mode: "error" | "truncate";
}

interface ReadTextResult {
  text: string;
  truncated: boolean;
}

interface FetchedStylesheet {
  cssText: string;
  truncated: boolean;
}

async function readTextWithinLimit(
  response: Response,
  maxBytes: number,
  options: ReadTextOptions,
): Promise<ReadTextResult> {
  if (!response.body) {
    return {
      text: "",
      truncated: false,
    };
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let output = "";

  while (true) {
    const chunk = await reader.read();
    if (chunk.done) {
      output += decoder.decode();
      break;
    }

    const remaining = maxBytes - total;
    if (chunk.value.byteLength > remaining) {
      if (remaining > 0) {
        output += decoder.decode(chunk.value.subarray(0, remaining), { stream: true });
      }
      reader.cancel().catch(() => undefined);
      if (options.mode === "error") {
        throw new Error(`Response body exceeded ${maxBytes} bytes.`);
      }

      return {
        text: `${output}${decoder.decode()}`,
        truncated: true,
      };
    }

    total += chunk.value.byteLength;
    output += decoder.decode(chunk.value, { stream: true });
  }

  return {
    text: output,
    truncated: false,
  };
}

function collectStylesheetLinks(html: string, baseUrl: URL): string[] {
  const $ = load(html);
  const discovered: string[] = [];

  $("link[rel='stylesheet'][href]").each((_, element) => {
    const href = $(element).attr("href");
    if (!href) {
      return;
    }

    try {
      const resolved = new URL(href, baseUrl);
      if (resolved.protocol === "http:" || resolved.protocol === "https:") {
        discovered.push(resolved.toString());
      }
    } catch {
      return;
    }
  });

  return discovered;
}

interface PreloadedFont {
  url: string;
  type: string | undefined;
}

function collectPreloadedFonts(html: string, baseUrl: URL): PreloadedFont[] {
  const $ = load(html);
  const fonts: PreloadedFont[] = [];

  $("link[rel='preload'][as='font'][href]").each((_, element) => {
    const href = $(element).attr("href");
    if (!href) {
      return;
    }

    try {
      const resolved = new URL(href, baseUrl);
      if (resolved.protocol === "http:" || resolved.protocol === "https:") {
        fonts.push({
          url: resolved.toString(),
          type: $(element).attr("type"),
        });
      }
    } catch {
      return;
    }
  });

  return fonts;
}

function inferFamilyFromUrl(fontUrl: string): string {
  try {
    const url = new URL(fontUrl);
    const pathname = url.pathname;
    const filename = pathname.split("/").pop() ?? "";
    const nameWithoutExt = filename.replace(/\.[^.]+$/, "");

    // Remove common suffixes like -Regular, -Bold, etc.
    const cleaned = nameWithoutExt
      .replace(/[-_](regular|bold|italic|light|medium|semibold|thin|black|variable|wght|ital)/gi, "")
      .replace(/[-_]\d+/g, ""); // Remove weight numbers

    // Convert kebab/snake case to title case
    const titleCased = cleaned
      .split(/[-_]/)
      .filter((s) => s.length > 0)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");

    return titleCased || "Unknown Font";
  } catch {
    return "Unknown Font";
  }
}

function collectInlineStyles(html: string): string[] {
  const $ = load(html);
  const styles: string[] = [];

  $("style").each((_, element) => {
    const cssText = $(element).html();
    if (cssText && cssText.trim().length > 0) {
      styles.push(cssText);
    }
  });

  return styles;
}

function deduplicateFonts(fonts: ExtractedFontSource[]): ExtractedFontSource[] {
  const formatPriority: Record<ExtractedFontSource["format"], number> = {
    woff2: 0,
    woff: 1,
    otf: 2,
    ttf: 3,
    eot: 4,
    svg: 5,
    unknown: 6,
  };

  const byVariant = new Map<string, ExtractedFontSource>();

  const normalizeFamilyKey = (value: string): string =>
    value
      .trim()
      .toLowerCase()
      .replace(/^['"]|['"]$/g, "")
      .replace(/\s+/g, " ");

  const normalizeWeightKey = (value: number | string | null): string => {
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(Math.round(value));
    }

    if (typeof value !== "string") {
      return "400";
    }

    const normalized = value.trim().toLowerCase();
    if (normalized.length === 0) {
      return "400";
    }

    if (normalized === "normal") {
      return "400";
    }

    if (normalized === "bold" || normalized === "bolder") {
      return "700";
    }

    if (normalized === "lighter") {
      return "300";
    }

    const numericParts = normalized
      .split(/\s+/)
      .map((piece) => Number(piece))
      .filter((piece) => Number.isFinite(piece));

    if (numericParts.length === 0) {
      return normalized;
    }

    const minimum = Math.min(...numericParts);
    const maximum = Math.max(...numericParts);

    return minimum === maximum ? String(minimum) : `${minimum} ${maximum}`;
  };

  const comparableUrlLength = (value: string): number => {
    try {
      const url = new URL(value);
      return `${url.origin}${url.pathname}`.length;
    } catch {
      return value.length;
    }
  };

  for (const font of fonts) {
    const key = `${normalizeFamilyKey(font.family)}::${font.style}::${normalizeWeightKey(font.weight)}`;
    const existing = byVariant.get(key);
    if (!existing) {
      byVariant.set(key, font);
      continue;
    }

    const existingRank = formatPriority[existing.format];
    const incomingRank = formatPriority[font.format];
    if (incomingRank < existingRank) {
      byVariant.set(key, font);
      continue;
    }

    if (
      incomingRank === existingRank &&
      comparableUrlLength(font.sourceUrl) < comparableUrlLength(existing.sourceUrl)
    ) {
      byVariant.set(key, font);
    }
  }

  return Array.from(byVariant.values());
}

async function fetchStylesheetText(
  stylesheetUrl: string,
  referer: string,
): Promise<FetchedStylesheet> {
  const response = await fetch(stylesheetUrl, {
    method: "GET",
    redirect: "follow",
    signal: AbortSignal.timeout(EXTRACTION_TIMEOUT_MS),
    headers: {
      ...BASE_REQUEST_HEADERS,
      accept: "text/css,*/*;q=0.1",
      referer,
    },
  });

  if (!response.ok) {
    throw new Error(`Stylesheet fetch failed (${response.status}).`);
  }

  const cssRead = await readTextWithinLimit(response, MAX_CSS_BYTES, { mode: "truncate" });
  return {
    cssText: cssRead.text,
    truncated: cssRead.truncated,
  };
}

async function crawlStylesheets(context: CrawlContext, referer: string): Promise<void> {
  const refererHostname = new URL(referer).hostname;

  while (context.queuedStylesheets.length > 0) {
    const next = context.queuedStylesheets.shift();
    if (!next) {
      continue;
    }

    if (next.depth > MAX_IMPORT_DEPTH) {
      context.warnings.push(`Skipped deep @import chain: ${next.url}`);
      continue;
    }

    try {
      const targetUrl = new URL(next.url);
      if (targetUrl.hostname !== refererHostname) {
        await assertSafeTargetUrl(targetUrl);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unsafe stylesheet URL.";
      context.warnings.push(`Skipped unsafe stylesheet ${next.url}: ${message}`);
      continue;
    }

    if (context.visitedStylesheets.has(next.url)) {
      continue;
    }

    if (context.stylesheetCount >= MAX_STYLESHEETS) {
      context.warnings.push(`Stopped crawl at ${MAX_STYLESHEETS} stylesheets.`);
      return;
    }

    context.visitedStylesheets.add(next.url);
    context.stylesheetCount += 1;

    try {
      const stylesheet = await fetchStylesheetText(next.url, referer);
      if (stylesheet.truncated) {
        context.warnings.push(`Truncated stylesheet at ${MAX_CSS_BYTES} bytes: ${next.url}`);
      }

      const parsed = parseCssForFonts(stylesheet.cssText, next.url);

      context.fontFaceCount += parsed.extractedFonts.length;
      context.extractedFonts.push(...parsed.extractedFonts);

      for (const importedUrl of parsed.importedStylesheets) {
        if (!context.visitedStylesheets.has(importedUrl)) {
          context.queuedStylesheets.push({
            url: importedUrl,
            depth: next.depth + 1,
          });
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown stylesheet parse error.";
      context.warnings.push(`Skipped stylesheet ${next.url}: ${message}`);
    }
  }
}

export async function extractFontsFromWebsite(inputUrl: URL): Promise<RawExtractionResult> {
  const referer = `${inputUrl.origin}/`;

  const response = await fetch(inputUrl.toString(), {
    method: "GET",
    redirect: "follow",
    signal: AbortSignal.timeout(EXTRACTION_TIMEOUT_MS),
    headers: BASE_REQUEST_HEADERS,
  });

  if (!response.ok) {
    throw new Error(`Website fetch failed (${response.status}).`);
  }

  const htmlRead = await readTextWithinLimit(response, MAX_HTML_BYTES, { mode: "truncate" });
  const html = htmlRead.text;

  const inlineStyles = collectInlineStyles(html);
  const linkedStylesheets = collectStylesheetLinks(html, inputUrl);
  const preloadedFonts = collectPreloadedFonts(html, inputUrl);

  const context: CrawlContext = {
    queuedStylesheets: linkedStylesheets.map((url) => ({ url, depth: 0 })),
    visitedStylesheets: new Set(),
    warnings: htmlRead.truncated
      ? [`Truncated HTML at ${MAX_HTML_BYTES} bytes; extracted from partial document.`]
      : [],
    extractedFonts: [],
    stylesheetCount: 0,
    fontFaceCount: 0,
  };

  for (const inlineCss of inlineStyles) {
    const parsed = parseCssForFonts(inlineCss, inputUrl.toString());
    context.fontFaceCount += parsed.extractedFonts.length;
    context.extractedFonts.push(...parsed.extractedFonts);

    for (const importedUrl of parsed.importedStylesheets) {
      context.queuedStylesheets.push({
        url: importedUrl,
        depth: 0,
      });
    }
  }

  await crawlStylesheets(context, referer);

  // Process preloaded fonts (common in Next.js, etc.)
  // Only add if not already found via @font-face rules
  const existingUrls = new Set(context.extractedFonts.map((f) => f.sourceUrl));
  for (const preloaded of preloadedFonts) {
    if (existingUrls.has(preloaded.url)) {
      continue;
    }

    const format = detectFontFormat(preloaded.url, preloaded.type);
    if (format === "unknown") {
      continue;
    }

    context.extractedFonts.push({
      family: inferFamilyFromUrl(preloaded.url),
      style: "normal",
      weight: null,
      sourceUrl: preloaded.url,
      format,
    });
    context.fontFaceCount += 1;
  }

  const uniqueFonts = deduplicateFonts(context.extractedFonts);

  return {
    referer,
    warnings: context.warnings,
    stats: {
      stylesheetCount: context.stylesheetCount,
      fontFaceCount: context.fontFaceCount,
      uniqueFontCount: uniqueFonts.length,
    },
    fonts: uniqueFonts,
  };
}
