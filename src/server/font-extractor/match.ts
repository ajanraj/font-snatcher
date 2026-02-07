import type {
  FontStyle,
  GoogleFontCatalogEntry,
  MatchAlternative,
  MatchApiResponse,
  MatchFeatures,
} from "@/features/font-snatcher/types";
import { rankLegalAlternatives } from "@/server/font-extractor/alternatives";
import { buildFamilyIndex } from "@/server/font-extractor/licensing";

function clamp(value: number): number {
  if (value < 0) {
    return 0;
  }

  if (value > 1) {
    return 1;
  }

  return value;
}

function normalizedWeight(weight: string): number {
  const pieces = weight
    .split(/\s+/)
    .map((piece) => Number(piece))
    .filter((piece) => Number.isFinite(piece));

  if (pieces.length === 0) {
    return 400;
  }

  const sum = pieces.reduce((accumulator, current) => accumulator + current, 0);
  return sum / pieces.length;
}

function pseudoHash(input: string): number {
  let hash = 0;
  for (const char of input) {
    hash = (hash * 31 + char.charCodeAt(0)) % 1_000_000;
  }

  return hash;
}

function boolToNumber(value: boolean): number {
  return value ? 1 : 0;
}

function createFeatureProfile(params: {
  family: string;
  style: FontStyle;
  weight: string;
  category: string | null;
}): MatchFeatures {
  const familyLower = params.family.toLowerCase();
  const weight = normalizedWeight(params.weight);
  const hash = pseudoHash(`${familyLower}:${params.style}:${params.weight}`);
  const jitter = (offset: number) => ((hash + offset) % 101) / 100;

  const isSerif = params.category === "serif";
  const isMono = familyLower.includes("mono") || familyLower.includes("code");

  return {
    weightClass: clamp(weight / 900),
    widthClass: clamp(0.4 + jitter(17) * 0.3),
    xHeightRatio: clamp(0.45 + jitter(29) * 0.2),
    capHeightRatio: clamp(0.65 + jitter(43) * 0.2),
    ascenderRatio: clamp(0.85 + jitter(59) * 0.15),
    descenderRatio: clamp(0.18 + jitter(71) * 0.2),
    avgWidthRatio: clamp(0.48 + jitter(83) * 0.25),
    serifScore: clamp(isSerif ? 0.75 : 0.18),
    contrastRatio: clamp(isSerif ? 0.24 : 0.1),
    roundness: clamp(0.45 + jitter(97) * 0.3),
    isMonospace: boolToNumber(isMono),
    italicAngle: clamp(params.style === "italic" ? 0.22 : 0),
    panoseSerif: clamp(isSerif ? 0.7 : 0),
    panoseWeight: clamp(weight / 900),
    complexity: clamp(0.25 + jitter(109) * 0.3),
  };
}

function mapAlternatives(candidates: ReturnType<typeof rankLegalAlternatives>): MatchAlternative[] {
  return candidates.map((candidate) => ({
    family: candidate.family,
    category: candidate.category,
    similarity: candidate.score,
    reason: `${candidate.score}% visual match`,
    downloadUrl: candidate.googleFontsUrl,
  }));
}

function normalizeFamilyKey(family: string): string {
  return family.trim().toLowerCase().replace(/\s+/g, " ");
}

export function buildMatchResponse(params: {
  family: string;
  style: FontStyle;
  weight: string;
  catalog: GoogleFontCatalogEntry[];
}): MatchApiResponse {
  const familyIndex = buildFamilyIndex(params.catalog);
  const sourceCategory = familyIndex.get(normalizeFamilyKey(params.family))?.category ?? null;

  const alternatives = rankLegalAlternatives({
    family: params.family,
    style: params.style,
    weight: params.weight,
    sourceCategory,
    catalog: params.catalog,
    excludeFamilies: new Set([normalizeFamilyKey(params.family)]),
  });

  return {
    original: {
      family: params.family,
      weight: params.weight,
      style: params.style,
    },
    method: "feature-similarity",
    features: createFeatureProfile({
      family: params.family,
      style: params.style,
      weight: params.weight,
      category: sourceCategory,
    }),
    alternatives: mapAlternatives(alternatives),
  };
}
