import type { FontLicenseStatus, GoogleFontCatalogEntry } from "@/features/font-snatcher/types";

const OPEN_LICENSE_NOTE =
  "Found in Google Fonts metadata (open-source family). Verify exact files and license terms before redistribution.";

const UNKNOWN_LICENSE_NOTE =
  "This font might not be free to use. Download at your own risk. Check the foundry license before commercial use.";

function normalizeFamilyKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function buildFamilyLookupKeys(value: string): string[] {
  const normalized = normalizeFamilyKey(value);
  const withoutVariableToken = normalizeFamilyKey(normalized.replace(/\b(variable|vf)\b/g, " "));

  const keys = new Set<string>();
  if (normalized.length > 0) {
    keys.add(normalized);
  }
  if (withoutVariableToken.length > 0) {
    keys.add(withoutVariableToken);
  }

  return Array.from(keys);
}

export function buildFamilyIndex(
  catalog: GoogleFontCatalogEntry[],
): Map<string, GoogleFontCatalogEntry> {
  const index = new Map<string, GoogleFontCatalogEntry>();

  for (const entry of catalog) {
    index.set(normalizeFamilyKey(entry.family), entry);
  }

  return index;
}

export function classifyFontLicense(
  family: string,
  familyIndex: Map<string, GoogleFontCatalogEntry>,
): { status: FontLicenseStatus; note: string } {
  const candidateKeys = buildFamilyLookupKeys(family);
  if (candidateKeys.some((key) => familyIndex.has(key))) {
    return {
      status: "free_open",
      note: OPEN_LICENSE_NOTE,
    };
  }

  return {
    status: "unknown_or_paid",
    note: UNKNOWN_LICENSE_NOTE,
  };
}
