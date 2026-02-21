import type { FontCardModel } from "@/features/font-snatcher/font-card";
import type {
  ExtractApiFontEntry,
  ExtractApiResponse,
  MatchAlternative,
  MatchApiResponse,
} from "@/features/font-snatcher/types";

// ─── Types ───

export interface ExtractState {
  isLoading: boolean;
  error: string | null;
  data: ExtractApiResponse | null;
}

// ─── Type guards ───

function isExtractApiResponse(value: unknown): value is ExtractApiResponse {
  if (!value || typeof value !== "object") {
    return false;
  }
  const fonts = Reflect.get(value, "fonts");
  const totalFound = Reflect.get(value, "totalFound");
  const sourceUrl = Reflect.get(value, "sourceUrl");
  return Array.isArray(fonts) && typeof totalFound === "number" && typeof sourceUrl === "string";
}

function isMatchApiResponse(value: unknown): value is MatchApiResponse {
  if (!value || typeof value !== "object") {
    return false;
  }
  const alternatives = Reflect.get(value, "alternatives");
  const method = Reflect.get(value, "method");
  return method === "feature-similarity" && Array.isArray(alternatives);
}

function parseErrorMessage(value: unknown): string | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const errorValue = Reflect.get(value, "error");
  if (typeof errorValue === "string") {
    return errorValue;
  }
  return null;
}

// ─── Utilities ───

function normalizeWeightLabel(weight: string): string {
  const trimmed = weight.trim();
  if (trimmed.length === 0) return "400";
  const lower = trimmed.toLowerCase();
  if (lower === "normal") return "400";
  if (lower === "bold") return "700";

  const numericPieces = trimmed
    .split(/\s+/u)
    .map((part) => Number.parseInt(part, 10))
    .filter((part) => Number.isFinite(part));
  if (numericPieces.length === 0) return trimmed;

  const clampWeight = (value: number): number => Math.min(900, Math.max(100, value));
  if (numericPieces.length === 1) return String(clampWeight(numericPieces[0]));

  const minimum = clampWeight(Math.min(...numericPieces));
  const maximum = clampWeight(Math.max(...numericPieces));
  return minimum === maximum ? String(minimum) : `${minimum} ${maximum}`;
}

export function openDownload(downloadUrl: string): void {
  window.location.assign(downloadUrl);
}

export function openExternalInNewTab(url: string): void {
  window.open(url, "_blank", "noopener,noreferrer");
}

export function toCardModel(font: ExtractApiFontEntry, index: number): FontCardModel {
  return {
    id: `${font.family.toLowerCase().replace(/\s+/g, "-")}-${index + 1}`,
    name: font.name,
    family: font.family,
    format: font.format,
    url: font.url,
    weight: normalizeWeightLabel(font.weight),
    style: font.style,
    referer: font.referer,
    previewUrl: font.previewUrl ?? font.url,
    downloadUrl: font.downloadUrl ?? font.url,
    licenseUrl: font.licenseUrl,
    licenseStatus: font.licenseStatus ?? "unknown_or_paid",
    licenseNote:
      font.licenseNote ??
      "This font might not be free to use. Download and usage are at your own risk.",
  };
}

export function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === "AbortError") ||
    (error instanceof Error && error.name === "AbortError")
  );
}

// ─── API ───

export async function fetchExtractedFonts(
  url: string,
  signal: AbortSignal,
): Promise<ExtractApiResponse> {
  const response = await fetch("/api/extract", {
    method: "POST",
    signal,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ url }),
  });
  const parsed = await response.json();
  if (!response.ok) {
    throw new Error(parseErrorMessage(parsed) ?? `Extraction failed (${response.status}).`);
  }
  if (!isExtractApiResponse(parsed)) {
    throw new Error("Invalid extraction response payload.");
  }
  return parsed;
}

export async function fetchAlternatives(font: FontCardModel): Promise<MatchAlternative[]> {
  const response = await fetch("/api/match", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      family: font.family,
      weight: font.weight,
      style: font.style,
      url: font.url,
      referer: font.referer,
    }),
  });
  const parsed = await response.json();
  if (!response.ok) {
    throw new Error(parseErrorMessage(parsed) ?? `Match failed (${response.status}).`);
  }
  if (!isMatchApiResponse(parsed)) {
    throw new Error("Invalid match response payload.");
  }
  return parsed.alternatives;
}
