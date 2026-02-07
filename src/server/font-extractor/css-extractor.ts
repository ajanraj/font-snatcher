import { parse as parseCss } from "@adobe/css-tools";
import { parse as parseFontFaceSrc, type FontFaceSrcItem } from "css-font-face-src";
import type { ExtractedFontSource, FontFormat } from "@/features/font-snatcher/types";
import type { CssRule } from "@adobe/css-tools";
import {
  detectFontFormat,
  normalizeFamilyName,
  parseStyleValue,
  parseWeightValue,
} from "@/server/font-extractor/url-utils";

interface ParsedCssResult {
  importedStylesheets: string[];
  extractedFonts: ExtractedFontSource[];
}

function parseImportValue(rawImport: string, baseUrl: string): string | null {
  const trimmed = rawImport.trim();
  const urlMatch = trimmed.match(/^url\((.+)\)/i);
  const quotedMatch = trimmed.match(/^['"](.+)['"]$/u);

  const rawTarget = urlMatch
    ? urlMatch[1]?.trim().replace(/^['"]|['"]$/gu, "")
    : quotedMatch
      ? quotedMatch[1]
      : null;

  if (!rawTarget) {
    return null;
  }

  try {
    const resolved = new URL(rawTarget, baseUrl);
    if (resolved.protocol === "http:" || resolved.protocol === "https:") {
      return resolved.toString();
    }
    return null;
  } catch {
    return null;
  }
}

function getDeclarationValue(
  declarations: { property?: string; value?: string }[] | undefined,
  property: string,
): string | undefined {
  if (!declarations) {
    return undefined;
  }

  for (const declaration of declarations) {
    if (declaration.property?.toLowerCase() === property) {
      return declaration.value;
    }
  }

  return undefined;
}

function resolveFontFaceUrl(rawUrl: string, stylesheetUrl: string): string | null {
  try {
    const resolved = new URL(rawUrl, stylesheetUrl);
    if (resolved.protocol !== "http:" && resolved.protocol !== "https:") {
      return null;
    }
    return resolved.toString();
  } catch {
    return null;
  }
}

function fontSourcesFromValue(srcValue: string): FontFaceSrcItem[] {
  try {
    return parseFontFaceSrc(srcValue);
  } catch {
    return [];
  }
}

function flattenCssRules(rules: CssRule[]): CssRule[] {
  const flattened: CssRule[] = [];

  for (const rule of rules) {
    flattened.push(rule);
    if (Array.isArray(rule.rules) && rule.rules.length > 0) {
      flattened.push(...flattenCssRules(rule.rules));
    }
  }

  return flattened;
}

function sanitizeFormat(format: FontFormat): FontFormat {
  if (format === "unknown") {
    return "unknown";
  }
  return format;
}

export function parseCssForFonts(cssText: string, stylesheetUrl: string): ParsedCssResult {
  const ast = parseCss(cssText, { silent: true, source: stylesheetUrl });
  const rootRules = ast.stylesheet.rules;

  const flattenedRules = flattenCssRules(rootRules);

  const importedStylesheets: string[] = [];
  const extractedFonts: ExtractedFontSource[] = [];

  for (const rule of flattenedRules) {
    if (rule.type === "import" && typeof rule.import === "string") {
      const maybeImportUrl = parseImportValue(rule.import, stylesheetUrl);
      if (maybeImportUrl) {
        importedStylesheets.push(maybeImportUrl);
      }
      continue;
    }

    if (rule.type !== "font-face") {
      continue;
    }

    const familyValue = getDeclarationValue(rule.declarations, "font-family");
    const srcValue = getDeclarationValue(rule.declarations, "src");

    if (!familyValue || !srcValue) {
      continue;
    }

    const style = parseStyleValue(getDeclarationValue(rule.declarations, "font-style"));
    const weight = parseWeightValue(getDeclarationValue(rule.declarations, "font-weight"));
    const family = normalizeFamilyName(familyValue);

    const parsedSources = fontSourcesFromValue(srcValue);
    for (const source of parsedSources) {
      if (!source.url) {
        continue;
      }

      const resolvedUrl = resolveFontFaceUrl(source.url, stylesheetUrl);
      if (!resolvedUrl) {
        continue;
      }

      extractedFonts.push({
        family,
        style,
        weight,
        sourceUrl: resolvedUrl,
        format: sanitizeFormat(detectFontFormat(resolvedUrl, source.format)),
      });
    }
  }

  return {
    importedStylesheets,
    extractedFonts,
  };
}
