import { rankLegalAlternatives } from "@/server/font-extractor/alternatives";
import { buildFamilyIndex, classifyFontLicense } from "@/server/font-extractor/licensing";
import type { GoogleFontCatalogEntry } from "@/features/font-snatcher/types";

const catalog: GoogleFontCatalogEntry[] = [
  {
    family: "Inter",
    category: "sans-serif",
    styles: ["normal", "italic"],
    weights: [100, 200, 300, 400, 500, 600, 700, 800, 900],
    subsets: ["latin"],
  },
  {
    family: "Krona One",
    category: "sans-serif",
    styles: ["normal"],
    weights: [400],
    subsets: ["latin"],
  },
  {
    family: "Merriweather",
    category: "serif",
    styles: ["normal", "italic"],
    weights: [300, 400, 700, 900],
    subsets: ["latin"],
  },
  {
    family: "Fira Mono",
    category: "monospace",
    styles: ["normal"],
    weights: [400, 500, 700],
    subsets: ["latin"],
  },
  {
    family: "Krub",
    category: "sans-serif",
    styles: ["normal", "italic"],
    weights: [200, 300, 400, 500, 600, 700],
    subsets: ["latin"],
  },
  {
    family: "Prosto One",
    category: "display",
    styles: ["normal"],
    weights: [400],
    subsets: ["latin"],
  },
];

describe("licensing + alternatives", () => {
  it("classifies open and unknown families", () => {
    const index = buildFamilyIndex(catalog);

    expect(
      classifyFontLicense("Inter", index, "https://fonts.gstatic.com/s/inter/inter.woff2").status,
    ).toBe("free_open");
    expect(
      classifyFontLicense(
        "Inter Variable",
        index,
        "https://fonts.gstatic.com/s/inter/inter-vf.woff2",
      ).status,
    ).toBe("free_open");
    expect(
      classifyFontLicense("Paid Brand Font", index, "https://use.typekit.net/abc.css").status,
    ).toBe("known_paid");
    expect(classifyFontLicense("Paid Brand Font", index, "https://cdn.site/pb.woff2").status).toBe(
      "unknown_or_paid",
    );
  });

  it("classifies known paid families by name", () => {
    const index = buildFamilyIndex(catalog);

    expect(classifyFontLicense("Berkeley Mono", index, "https://cdn.site/font.woff2").status).toBe(
      "known_paid",
    );
    expect(classifyFontLicense("Proxima Vera", index, "https://cdn.site/font.woff2").status).toBe(
      "known_paid",
    );
    expect(classifyFontLicense("GT America", index, "https://cdn.site/font.woff2").status).toBe(
      "known_paid",
    );
    expect(classifyFontLicense("FF DIN Pro", index, "https://cdn.site/font.woff2").status).toBe(
      "known_paid",
    );
    expect(
      classifyFontLicense("Neue Haas Grotesk Display", index, "https://cdn.site/font.woff2").status,
    ).toBe("known_paid");
    expect(classifyFontLicense("Circular Std", index, "https://cdn.site/font.woff2").status).toBe(
      "known_paid",
    );
  });

  it("returns top legal alternatives", () => {
    const alternatives = rankLegalAlternatives({
      family: "Inter Variable",
      style: "italic",
      weight: "100 900",
      sourceCategory: "sans-serif",
      catalog,
      excludeFamilies: new Set(["inter variable"]),
    });

    expect(alternatives.length).toBeLessThanOrEqual(5);
    expect(alternatives[0]?.family).toBe("Inter");
    expect(alternatives[0]?.googleFontsUrl).toContain("fonts.google.com/specimen/");
  });

  it("produces differentiated similarity scores for unknown families", () => {
    const alternatives = rankLegalAlternatives({
      family: "Geist",
      style: "normal",
      weight: "100 900",
      sourceCategory: null,
      catalog,
      excludeFamilies: new Set(["geist"]),
    });

    expect(alternatives).toHaveLength(5);
    expect(alternatives[0]?.score).toBeGreaterThanOrEqual(alternatives[4]?.score ?? 0);
    expect(new Set(alternatives.map((alternative) => alternative.score)).size).toBeGreaterThan(1);
  });
});
