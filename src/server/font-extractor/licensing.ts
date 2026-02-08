import type { FontLicenseStatus, GoogleFontCatalogEntry } from "@/features/font-snatcher/types";

const OPEN_LICENSE_NOTE =
  "Found in Google Fonts metadata (open-source family). Verify exact files and license terms before redistribution.";

const UNKNOWN_LICENSE_NOTE =
  "This font might not be free to use. Download at your own risk. Check the foundry license before commercial use.";

interface PaidProvider {
  hostMatchers: string[];
  provider: string;
  licenseUrl: string;
}

interface PaidFamilyRule {
  familyMatchers: string[];
  provider: string;
  licenseUrl: string;
}

const PAID_PROVIDERS: PaidProvider[] = [
  {
    hostMatchers: ["typekit.net", "use.typekit.net", "p.typekit.net", "adobe.com"],
    provider: "Adobe Fonts",
    licenseUrl: "https://helpx.adobe.com/fonts/using/font-licensing.html",
  },
  {
    hostMatchers: ["fonts.com", "fonts.net", "monotype.com"],
    provider: "Monotype Fonts",
    licenseUrl: "https://www.monotype.com/legal/font-licensing",
  },
  {
    hostMatchers: ["myfonts.net", "myfonts.com"],
    provider: "MyFonts",
    licenseUrl: "https://www.myfonts.com/pages/licensing",
  },
  {
    hostMatchers: ["typography.com", "cloud.typography.com", "hoefler.com"],
    provider: "Hoefler&Co",
    licenseUrl: "https://www.typography.com/licenses",
  },
  {
    hostMatchers: ["linotype.com"],
    provider: "Linotype",
    licenseUrl: "https://www.linotype.com/help-45-faq-license-types.html",
  },
];

const PAID_FAMILY_RULES: PaidFamilyRule[] = [
  {
    familyMatchers: ["berkeley mono"],
    provider: "Berkeley Graphics",
    licenseUrl: "https://berkeleygraphics.com/typefaces/berkeley-mono/",
  },
  {
    familyMatchers: ["proxima nova", "proxima vara", "proxima vera", "proxima sera"],
    provider: "Mark Simonson Studio",
    licenseUrl: "https://www.marksimonson.com/proxima-super-nova/licensing/",
  },
  {
    familyMatchers: ["gotham"],
    provider: "Hoefler&Co",
    licenseUrl: "https://typography.com/licenses",
  },
  {
    familyMatchers: ["helvetica", "helvetica neue", "helvetica now"],
    provider: "Monotype",
    licenseUrl: "https://www.monotype.com/resources/font-licensing",
  },
  {
    familyMatchers: ["avenir", "avenir next"],
    provider: "Monotype",
    licenseUrl: "https://www.monotype.com/resources/font-licensing",
  },
  {
    familyMatchers: ["din next"],
    provider: "Monotype",
    licenseUrl: "https://www.monotype.com/resources/font-licensing",
  },
  {
    familyMatchers: ["graphik"],
    provider: "Commercial Type",
    licenseUrl: "https://commercialtype.com/faqs",
  },
  {
    familyMatchers: ["gt america"],
    provider: "Grilli Type",
    licenseUrl: "https://www.grillitype.com/information",
  },
  {
    familyMatchers: ["suisse int'l", "suisse intl", "suisse int"],
    provider: "Swiss Typefaces",
    licenseUrl: "https://www.swisstypefaces.com/licensing/",
  },
  {
    familyMatchers: ["euclid circular", "euclid circular a", "euclid circular b"],
    provider: "Swiss Typefaces",
    licenseUrl: "https://www.swisstypefaces.com/licensing/",
  },
  {
    familyMatchers: ["brandon grotesque"],
    provider: "HVD Fonts",
    licenseUrl: "https://www.hvdfonts.com/fonts/brandon-grotesque",
  },
  {
    familyMatchers: ["ff din"],
    provider: "FontFont",
    licenseUrl: "https://www.myfonts.com/collections/ff-din-font-fontfont/",
  },
  {
    familyMatchers: ["frutiger"],
    provider: "Linotype",
    licenseUrl: "https://www.monotype.com/resources/font-licensing",
  },
  {
    familyMatchers: ["univers"],
    provider: "Linotype",
    licenseUrl: "https://www.monotype.com/resources/font-licensing",
  },
  {
    familyMatchers: ["neue haas grotesk"],
    provider: "Linotype",
    licenseUrl: "https://www.monotype.com/resources/font-licensing",
  },
  {
    familyMatchers: ["aktiv grotesk"],
    provider: "Dalton Maag",
    licenseUrl: "https://www.daltonmaag.com/font-library/aktiv-grotesk.html",
  },
  {
    familyMatchers: ["circular", "circular std"],
    provider: "Lineto",
    licenseUrl: "https://lineto.com/information/help/licence-user-rights/basic-licencing",
  },
  {
    familyMatchers: ["apercu"],
    provider: "Colophon Foundry",
    licenseUrl: "https://www.myfonts.com/collections/apercu-font-colophon-foundry/",
  },
  {
    familyMatchers: ["canela"],
    provider: "Commercial Type",
    licenseUrl: "https://commercialtype.com/catalog/canela",
  },
  {
    familyMatchers: ["maison neue"],
    provider: "Milieu Grotesque",
    licenseUrl: "https://www.myfonts.com/collections/maison-neue-font-milieu-grotesque/",
  },
  {
    familyMatchers: ["futura pt"],
    provider: "ParaType",
    licenseUrl: "https://www.myfonts.com/collections/futura-book-font-paratype/",
  },
];

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

function lookupPaidProvider(sourceUrl: string | undefined): PaidProvider | null {
  if (!sourceUrl) {
    return null;
  }

  let host: string;
  try {
    host = new URL(sourceUrl).hostname.toLowerCase();
  } catch {
    return null;
  }

  const provider = PAID_PROVIDERS.find((candidate) =>
    candidate.hostMatchers.some((matcher) => host === matcher || host.endsWith(`.${matcher}`)),
  );

  return provider ?? null;
}

function lookupPaidFamily(family: string): PaidFamilyRule | null {
  const normalizedFamily = normalizeFamilyKey(family);

  const rule = PAID_FAMILY_RULES.find((candidate) =>
    candidate.familyMatchers.some((familyMatcher) => {
      const normalizedMatcher = normalizeFamilyKey(familyMatcher);
      return (
        normalizedFamily === normalizedMatcher ||
        normalizedFamily.startsWith(`${normalizedMatcher} `) ||
        normalizedFamily.endsWith(` ${normalizedMatcher}`)
      );
    }),
  );

  return rule ?? null;
}

export function classifyFontLicense(
  family: string,
  familyIndex: Map<string, GoogleFontCatalogEntry>,
  sourceUrl?: string,
): { status: FontLicenseStatus; note: string; licenseUrl?: string } {
  const candidateKeys = buildFamilyLookupKeys(family);
  if (candidateKeys.some((key) => familyIndex.has(key))) {
    return {
      status: "free_open",
      note: OPEN_LICENSE_NOTE,
    };
  }

  const paidFamily = lookupPaidFamily(family);
  if (paidFamily) {
    return {
      status: "known_paid",
      note: `Known commercially licensed family (${paidFamily.provider}). Get a proper license before production use.`,
      licenseUrl: paidFamily.licenseUrl,
    };
  }

  const paidProvider = lookupPaidProvider(sourceUrl);
  if (paidProvider) {
    return {
      status: "known_paid",
      note: `Likely served by ${paidProvider.provider}. Get a proper license before production use.`,
      licenseUrl: paidProvider.licenseUrl,
    };
  }

  return {
    status: "unknown_or_paid",
    note: UNKNOWN_LICENSE_NOTE,
  };
}
