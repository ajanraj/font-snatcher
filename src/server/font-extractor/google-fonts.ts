import type { GoogleFontCatalogEntry } from "@/features/font-snatcher/types";
import snapshotRaw from "@/data/google-fonts.snapshot.json";

let cachedSnapshot: GoogleFontCatalogEntry[] | null = null;

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isNumberArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((item) => typeof item === "number");
}

function isCatalogEntry(value: unknown): value is GoogleFontCatalogEntry {
  if (!value || typeof value !== "object") {
    return false;
  }

  const family = Reflect.get(value, "family");
  const category = Reflect.get(value, "category");
  const styles = Reflect.get(value, "styles");
  const weights = Reflect.get(value, "weights");
  const subsets = Reflect.get(value, "subsets");

  return (
    typeof family === "string" &&
    typeof category === "string" &&
    isStringArray(styles) &&
    isNumberArray(weights) &&
    isStringArray(subsets)
  );
}

export async function getGoogleFontsSnapshot(): Promise<GoogleFontCatalogEntry[]> {
  if (cachedSnapshot) {
    return cachedSnapshot;
  }

  const parsed: unknown = snapshotRaw;

  if (!Array.isArray(parsed)) {
    throw new Error("Invalid Google Fonts snapshot format.");
  }

  const validated = parsed.filter((entry) => isCatalogEntry(entry));
  cachedSnapshot = validated;

  return validated;
}
