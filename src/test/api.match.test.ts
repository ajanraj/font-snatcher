import { beforeEach, vi } from "vitest";

vi.mock("@/server/font-extractor/google-fonts", () => ({
  getGoogleFontsSnapshot: vi.fn(async () => []),
}));

vi.mock("@/server/font-extractor/match", () => ({
  buildMatchResponse: vi.fn(() => ({
    original: { family: "Inter", weight: "400", style: "normal" },
    method: "feature-similarity",
    features: {
      weightClass: 0.4,
      widthClass: 0.5,
      xHeightRatio: 0.5,
      capHeightRatio: 0.7,
      ascenderRatio: 0.9,
      descenderRatio: 0.2,
      avgWidthRatio: 0.6,
      serifScore: 0.2,
      contrastRatio: 0.1,
      roundness: 0.5,
      isMonospace: 0,
      italicAngle: 0,
      panoseSerif: 0,
      panoseWeight: 0.4,
      complexity: 0.4,
    },
    alternatives: [],
  })),
}));

import { getGoogleFontsSnapshot } from "@/server/font-extractor/google-fonts";
import { buildMatchResponse } from "@/server/font-extractor/match";
import { handleMatchRequest } from "@/routes/api.match";

function errorMessage(value: unknown): string | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const raw = Reflect.get(value, "error");
  return typeof raw === "string" ? raw : null;
}

function methodValue(value: unknown): string | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const raw = Reflect.get(value, "method");
  return typeof raw === "string" ? raw : null;
}

describe("POST /api/match", () => {
  beforeEach(() => {
    vi.mocked(getGoogleFontsSnapshot).mockResolvedValue([]);
  });

  it("validates family presence", async () => {
    const request = new Request("http://localhost/api/match", {
      method: "POST",
      body: JSON.stringify({ style: "normal" }),
      headers: { "content-type": "application/json" },
    });

    const response = await handleMatchRequest(request);
    const body: unknown = await response.json();

    expect(response.status).toBe(400);
    expect(errorMessage(body)).toContain("Font family is required");
  });

  it("returns feature similarity response", async () => {
    const request = new Request("http://localhost/api/match", {
      method: "POST",
      body: JSON.stringify({
        family: "Inter Variable",
        weight: "100 900",
        style: "italic",
      }),
      headers: { "content-type": "application/json" },
    });

    const response = await handleMatchRequest(request);
    const body: unknown = await response.json();

    expect(response.status).toBe(200);
    expect(methodValue(body)).toBe("feature-similarity");
    expect(vi.mocked(buildMatchResponse)).toHaveBeenCalledTimes(1);
  });
});
