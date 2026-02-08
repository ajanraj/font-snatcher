import type {
  ExtractApiResponse,
  ExtractFontsResponse,
  FontStyle,
  GoogleFontCatalogEntry,
} from "@/features/font-snatcher/types";
import { LEGAL_WARNING_COPY } from "@/server/font-extractor/constants";
import { rankLegalAlternatives } from "@/server/font-extractor/alternatives";
import { extractFontsFromWebsite } from "@/server/font-extractor/extract-fonts";
import { getGoogleFontsSnapshot } from "@/server/font-extractor/google-fonts";
import { buildFamilyIndex, classifyFontLicense } from "@/server/font-extractor/licensing";
import { createSignedProxyUrl } from "@/server/font-extractor/proxy-signing";

interface BuildResponseOptions {
  inputUrl: string;
  normalizedUrl: string;
  referer: string;
  warnings: string[];
  durationMs: number;
  stats: {
    stylesheetCount: number;
    fontFaceCount: number;
    uniqueFontCount: number;
  };
  fonts: {
    family: string;
    style: FontStyle;
    weight: number | string | null;
    format: "woff2" | "woff" | "ttf" | "otf" | "eot" | "svg" | "unknown";
    sourceUrl: string;
  }[];
  catalog: GoogleFontCatalogEntry[];
}

function categoryForFamily(
  family: string,
  familyIndex: Map<string, GoogleFontCatalogEntry>,
): string | null {
  const normalized = family.trim().toLowerCase().replace(/\s+/g, " ");
  const entry = familyIndex.get(normalized);
  return entry ? entry.category : null;
}

function buildResponse(options: BuildResponseOptions): ExtractFontsResponse {
  const familyIndex = buildFamilyIndex(options.catalog);

  const fonts = options.fonts.map((font, index) => {
    const sourceHost = new URL(font.sourceUrl).host;
    const license = classifyFontLicense(font.family, familyIndex, font.sourceUrl);

    const alternatives =
      license.status !== "free_open"
        ? rankLegalAlternatives({
            family: font.family,
            style: font.style,
            weight: font.weight,
            sourceCategory: categoryForFamily(font.family, familyIndex),
            catalog: options.catalog,
            excludeFamilies: new Set([font.family.toLowerCase()]),
          })
        : [];

    const downloadUrl =
      license.status === "known_paid" && license.licenseUrl
        ? license.licenseUrl
        : createSignedProxyUrl({
            fontUrl: font.sourceUrl,
            referer: options.referer,
            download: true,
          });

    return {
      id: `${font.family.toLowerCase().replace(/\s+/g, "-")}-${index + 1}`,
      family: font.family,
      style: font.style,
      weight: font.weight,
      format: font.format,
      sourceUrl: font.sourceUrl,
      sourceHost,
      previewUrl: createSignedProxyUrl({
        fontUrl: font.sourceUrl,
        referer: options.referer,
        download: false,
      }),
      downloadUrl,
      licenseStatus: license.status,
      licenseNote: license.status === "unknown_or_paid" ? LEGAL_WARNING_COPY : license.note,
      licenseUrl: license.licenseUrl,
      alternatives,
    };
  });

  return {
    site: {
      inputUrl: options.inputUrl,
      normalizedUrl: options.normalizedUrl,
      referer: options.referer,
      durationMs: options.durationMs,
      warnings: options.warnings,
    },
    stats: options.stats,
    fonts,
  };
}

export async function extractFontsResponse(inputUrl: URL): Promise<ExtractFontsResponse> {
  const started = Date.now();
  const [catalog, rawExtraction] = await Promise.all([
    getGoogleFontsSnapshot(),
    extractFontsFromWebsite(inputUrl),
  ]);

  return buildResponse({
    inputUrl: inputUrl.toString(),
    normalizedUrl: inputUrl.toString(),
    referer: rawExtraction.referer,
    warnings: rawExtraction.warnings,
    durationMs: Date.now() - started,
    stats: rawExtraction.stats,
    fonts: rawExtraction.fonts,
    catalog,
  });
}

function formatToDisplayLabel(format: string): string {
  return format.toUpperCase();
}

function weightToString(weight: number | string | null): string {
  if (weight === null) {
    return "400";
  }

  return String(weight);
}

export async function extractApiResponse(inputUrl: URL): Promise<ExtractApiResponse> {
  const richResponse = await extractFontsResponse(inputUrl);

  return {
    fonts: richResponse.fonts.map((font) => ({
      name: decodeURIComponent(new URL(font.sourceUrl).pathname.split("/").at(-1) ?? font.family),
      family: font.family,
      format: formatToDisplayLabel(font.format),
      url: font.sourceUrl,
      weight: weightToString(font.weight),
      style: font.style,
      referer: richResponse.site.referer,
      previewUrl: font.previewUrl,
      downloadUrl: font.downloadUrl,
      licenseStatus: font.licenseStatus,
      licenseNote: font.licenseNote,
      licenseUrl: font.licenseUrl,
    })),
    totalFound: richResponse.stats.uniqueFontCount,
    sourceUrl: richResponse.site.normalizedUrl,
  };
}
