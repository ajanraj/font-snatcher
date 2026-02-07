import type {
  AlternativeCandidate,
  FontStyle,
  GoogleFontCatalogEntry,
} from "@/features/font-snatcher/types";

function normalizeFamily(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

const FAMILY_STOP_WORDS = new Set([
  "variable",
  "vf",
  "roman",
  "display",
  "text",
  "std",
  "pro",
  "web",
]);

function canonicalFamily(value: string): string {
  const normalized = normalizeFamily(value);
  if (normalized.length === 0) {
    return normalized;
  }

  const canonicalTokens = normalized
    .split(" ")
    .filter((token) => token.length > 0 && !FAMILY_STOP_WORDS.has(token));

  if (canonicalTokens.length === 0) {
    return normalized;
  }

  return canonicalTokens.join(" ");
}

function normalizeTokens(value: string): string[] {
  const normalized = canonicalFamily(value);
  if (normalized.length === 0) {
    return [];
  }

  return normalized.split(" ").filter((token) => token.length > 0 && !FAMILY_STOP_WORDS.has(token));
}

function jaccardSimilarity(left: string[], right: string[]): number {
  const leftSet = new Set(left);
  const rightSet = new Set(right);

  if (leftSet.size === 0 && rightSet.size === 0) {
    return 1;
  }

  let intersection = 0;
  for (const token of leftSet) {
    if (rightSet.has(token)) {
      intersection += 1;
    }
  }

  const union = leftSet.size + rightSet.size - intersection;
  if (union === 0) {
    return 0;
  }

  return intersection / union;
}

function diceCoefficient(left: string, right: string): number {
  if (left === right) {
    return 1;
  }

  if (left.length < 2 || right.length < 2) {
    return 0;
  }

  const pairs = (value: string) => {
    const output: string[] = [];
    for (let index = 0; index < value.length - 1; index += 1) {
      output.push(value.slice(index, index + 2));
    }
    return output;
  };

  const leftPairs = pairs(left);
  const rightPairs = pairs(right);
  const rightCounts = new Map<string, number>();

  for (const pair of rightPairs) {
    rightCounts.set(pair, (rightCounts.get(pair) ?? 0) + 1);
  }

  let matches = 0;
  for (const pair of leftPairs) {
    const count = rightCounts.get(pair) ?? 0;
    if (count > 0) {
      matches += 1;
      rightCounts.set(pair, count - 1);
    }
  }

  return (2 * matches) / (leftPairs.length + rightPairs.length);
}

function normalizedLevenshteinSimilarity(left: string, right: string): number {
  if (left === right) {
    return 1;
  }

  if (left.length === 0 || right.length === 0) {
    return 0;
  }

  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  const current = Array.from({ length: right.length + 1 }, () => 0);

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    current[0] = leftIndex;
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const cost = left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;
      const replace = previous[rightIndex - 1] + cost;
      const insert = current[rightIndex - 1] + 1;
      const remove = previous[rightIndex] + 1;
      current[rightIndex] = Math.min(replace, insert, remove);
    }

    for (let index = 0; index < previous.length; index += 1) {
      previous[index] = current[index];
    }
  }

  const distance = previous[right.length];
  const denominator = Math.max(left.length, right.length);
  return 1 - distance / denominator;
}

function parseWeightRange(weight: number | string | null): { min: number; max: number } {
  if (typeof weight === "number" && Number.isFinite(weight)) {
    return { min: weight, max: weight };
  }

  if (typeof weight === "string") {
    const pieces = weight
      .split(/\s+/)
      .map((piece) => Number(piece))
      .filter((piece) => Number.isFinite(piece));

    if (pieces.length > 0) {
      return {
        min: Math.min(...pieces),
        max: Math.max(...pieces),
      };
    }
  }

  return { min: 400, max: 400 };
}

function styleCompatibility(style: FontStyle, candidate: GoogleFontCatalogEntry): number {
  if (candidate.styles.includes(style)) {
    return 1;
  }

  if (candidate.styles.includes("normal") && style !== "normal") {
    return 0.6;
  }

  return 0.25;
}

function weightCompatibility(
  weight: number | string | null,
  candidate: GoogleFontCatalogEntry,
): number {
  if (candidate.weights.length === 0) {
    return 0.4;
  }

  const targetRange = parseWeightRange(weight);
  const candidateMinimum = Math.min(...candidate.weights);
  const candidateMaximum = Math.max(...candidate.weights);

  const overlapMinimum = Math.max(targetRange.min, candidateMinimum);
  const overlapMaximum = Math.min(targetRange.max, candidateMaximum);
  if (overlapMinimum <= overlapMaximum) {
    return 1;
  }

  const distance =
    targetRange.max < candidateMinimum
      ? candidateMinimum - targetRange.max
      : targetRange.min - candidateMaximum;

  if (distance <= 100) {
    return 0.8;
  }
  if (distance <= 200) {
    return 0.6;
  }
  if (distance <= 300) {
    return 0.4;
  }

  return 0.2;
}

function inferCategoryFromFamily(family: string): string | null {
  const normalized = normalizeFamily(family);
  if (normalized.length === 0) {
    return null;
  }

  if (/\b(mono|code|console|terminal)\b/.test(normalized)) {
    return "monospace";
  }
  if (/\b(script|hand|cursive|brush)\b/.test(normalized)) {
    return "handwriting";
  }
  if (/\b(serif|roman|garamond|times|tiempos)\b/.test(normalized)) {
    return "serif";
  }
  if (/\b(display|headline|poster|impact|blackletter)\b/.test(normalized)) {
    return "display";
  }

  return "sans-serif";
}

function categoryCompatibility(sourceCategory: string | null, candidateCategory: string): number {
  if (!sourceCategory) {
    return 0.5;
  }

  if (sourceCategory === candidateCategory) {
    return 1;
  }

  if (
    (sourceCategory === "sans-serif" && candidateCategory === "display") ||
    (sourceCategory === "display" && candidateCategory === "sans-serif")
  ) {
    return 0.75;
  }

  if (
    (sourceCategory === "serif" && candidateCategory === "display") ||
    (sourceCategory === "display" && candidateCategory === "serif")
  ) {
    return 0.55;
  }

  if (
    (sourceCategory === "sans-serif" && candidateCategory === "handwriting") ||
    (sourceCategory === "handwriting" && candidateCategory === "sans-serif")
  ) {
    return 0.45;
  }

  if (
    (sourceCategory === "monospace" && candidateCategory === "sans-serif") ||
    (sourceCategory === "sans-serif" && candidateCategory === "monospace")
  ) {
    return 0.55;
  }

  return 0.3;
}

function buildGoogleFontsUrl(family: string): string {
  return `https://fonts.google.com/specimen/${encodeURIComponent(family).replace(/%20/g, "+")}`;
}

function clamp(value: number): number {
  if (value < 0) {
    return 0;
  }
  if (value > 1) {
    return 1;
  }
  return value;
}

function buildNameScore(source: string, candidate: string): number {
  const sourceTokens = normalizeTokens(source);
  const candidateTokens = normalizeTokens(candidate);
  const tokenScore = jaccardSimilarity(sourceTokens, candidateTokens);

  const sourceCanonical = canonicalFamily(source);
  const candidateCanonical = canonicalFamily(candidate);

  const charScore = Math.max(
    diceCoefficient(sourceCanonical, candidateCanonical),
    normalizedLevenshteinSimilarity(sourceCanonical, candidateCanonical),
  );

  const containsScore =
    sourceCanonical.includes(candidateCanonical) || candidateCanonical.includes(sourceCanonical)
      ? 1
      : 0;

  return clamp(tokenScore * 0.45 + charScore * 0.45 + containsScore * 0.1);
}

export function rankLegalAlternatives(params: {
  family: string;
  style: FontStyle;
  weight: number | string | null;
  sourceCategory: string | null;
  catalog: GoogleFontCatalogEntry[];
  excludeFamilies: Set<string>;
}): AlternativeCandidate[] {
  const sourceFamilyNormalized = normalizeFamily(params.family);
  const sourceCategory = params.sourceCategory ?? inferCategoryFromFamily(params.family);
  const sourceLooksMonospace = /\b(mono|code|console|terminal)\b/.test(sourceFamilyNormalized);

  const excludeNormalized = new Set<string>(
    Array.from(params.excludeFamilies).map((family) => normalizeFamily(family)),
  );

  const ranked = params.catalog
    .filter((entry) => !excludeNormalized.has(normalizeFamily(entry.family)))
    .map((entry) => {
      const nameScore = buildNameScore(params.family, entry.family);
      const categoryScore = categoryCompatibility(sourceCategory, entry.category);
      const styleScore = styleCompatibility(params.style, entry);
      const weightScore = weightCompatibility(params.weight, entry);
      const monoScore = sourceLooksMonospace ? (entry.category === "monospace" ? 1 : 0.15) : 0.5;
      const rawScore =
        nameScore * 0.27 +
        categoryScore * 0.27 +
        styleScore * 0.16 +
        weightScore * 0.2 +
        monoScore * 0.1;

      return {
        family: entry.family,
        rawScore,
        category: entry.category,
        googleFontsUrl: buildGoogleFontsUrl(entry.family),
      };
    })
    .sort((left, right) => {
      if (right.rawScore !== left.rawScore) {
        return right.rawScore - left.rawScore;
      }
      return left.family.localeCompare(right.family);
    });

  const topRawScore = ranked[0]?.rawScore ?? 0;

  return ranked.slice(0, 5).map((entry) => {
    const relativeScore = topRawScore > 0 ? entry.rawScore / topRawScore : 0;
    const blendedScore = clamp(entry.rawScore * 0.45 + relativeScore * 0.55);
    const score = Math.round(clamp(0.2 + blendedScore * 0.78) * 100);
    return {
      family: entry.family,
      score,
      category: entry.category,
      googleFontsUrl: entry.googleFontsUrl,
    };
  });
}
