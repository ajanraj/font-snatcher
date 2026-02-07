import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

interface SnapshotEntry {
  family: string;
  category: string;
  styles: Array<"normal" | "italic" | "oblique">;
  weights: number[];
  subsets: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toCategory(value: unknown): string {
  return typeof value === "string" && value.length > 0 ? value : "sans-serif";
}

function toSubsets(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string" && item.length > 0);
}

function toStylesAndWeights(value: unknown): {
  styles: Array<"normal" | "italic" | "oblique">;
  weights: number[];
} {
  if (!isRecord(value)) {
    return {
      styles: ["normal"],
      weights: [400],
    };
  }

  const styleCandidates: Array<"normal" | "italic" | "oblique"> = [];
  const weightSet = new Set<number>();

  for (const [styleKey, styleValue] of Object.entries(value)) {
    if (!isRecord(styleValue)) {
      continue;
    }

    const normalizedStyle =
      styleKey === "italic" ? "italic" : styleKey === "oblique" ? "oblique" : "normal";

    if (!styleCandidates.includes(normalizedStyle)) {
      styleCandidates.push(normalizedStyle);
    }

    for (const weightKey of Object.keys(styleValue)) {
      const parsedWeight = Number(weightKey);
      if (Number.isFinite(parsedWeight)) {
        weightSet.add(parsedWeight);
      }
    }
  }

  if (styleCandidates.length === 0) {
    styleCandidates.push("normal");
  }

  if (weightSet.size === 0) {
    weightSet.add(400);
  }

  return {
    styles: styleCandidates,
    weights: [...weightSet].sort((left, right) => left - right),
  };
}

async function run(): Promise<void> {
  const repoRoot = process.cwd();
  const sourceFilePath = path.join(
    repoRoot,
    "node_modules",
    "google-fonts-complete",
    "google-fonts.json",
  );
  const destinationFilePath = path.join(repoRoot, "src", "data", "google-fonts.snapshot.json");

  const sourceRaw = await readFile(sourceFilePath, "utf8");
  const sourceJson: unknown = JSON.parse(sourceRaw);

  if (!isRecord(sourceJson)) {
    throw new Error("Unexpected source format in google-fonts-complete JSON.");
  }

  const entries: SnapshotEntry[] = [];

  for (const [family, rawEntry] of Object.entries(sourceJson)) {
    if (!isRecord(rawEntry)) {
      continue;
    }

    const category = toCategory(rawEntry.category);
    const subsets = toSubsets(rawEntry.subsets);
    const variants = toStylesAndWeights(rawEntry.variants);

    entries.push({
      family,
      category,
      styles: variants.styles,
      weights: variants.weights,
      subsets,
    });
  }

  entries.sort((left, right) => left.family.localeCompare(right.family));

  await writeFile(destinationFilePath, `${JSON.stringify(entries, null, 2)}\n`, "utf8");
  console.log(`Wrote ${entries.length} font entries to ${destinationFilePath}`);
}

run().catch((error) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  console.error(message);
  process.exitCode = 1;
});
