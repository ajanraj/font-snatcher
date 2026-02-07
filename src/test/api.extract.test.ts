import { beforeEach, vi } from "vitest";

vi.mock("@/server/font-extractor", () => ({
  extractApiResponse: vi.fn(async () => ({
    fonts: [],
    totalFound: 0,
    sourceUrl: "https://example.com/",
  })),
}));

vi.mock("@/server/font-extractor/ssrf", () => ({
  assertSafeTargetUrl: vi.fn(async () => undefined),
}));

import { extractApiResponse } from "@/server/font-extractor";
import { assertSafeTargetUrl } from "@/server/font-extractor/ssrf";
import { handleExtractRequest } from "@/routes/api.extract";

function extractErrorMessage(value: unknown): string | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const message = Reflect.get(value, "error");
  return typeof message === "string" ? message : null;
}

describe("POST /api/extract", () => {
  beforeEach(() => {
    vi.mocked(assertSafeTargetUrl).mockResolvedValue(undefined);
    vi.mocked(extractApiResponse).mockResolvedValue({
      fonts: [],
      totalFound: 0,
      sourceUrl: "https://example.com/",
    });
  });

  it("rejects invalid payload", async () => {
    const request = new Request("http://localhost/api/extract", {
      method: "POST",
      body: JSON.stringify({ url: 123 }),
      headers: { "content-type": "application/json" },
    });

    const response = await handleExtractRequest(request);
    const body: unknown = await response.json();

    expect(response.status).toBe(400);
    expect(extractErrorMessage(body)).toContain("Invalid request payload");
  });

  it("returns normalized extraction payload", async () => {
    vi.mocked(extractApiResponse).mockResolvedValue({
      fonts: [
        {
          name: "InterVariable.woff2",
          family: "Inter Variable",
          format: "WOFF2",
          url: "https://static.linear.app/fonts/InterVariable.woff2",
          weight: "100 900",
          style: "italic",
          referer: "https://linear.app/",
        },
      ],
      totalFound: 1,
      sourceUrl: "https://linear.app/",
    });

    const request = new Request("http://localhost/api/extract", {
      method: "POST",
      body: JSON.stringify({ url: "linear.app" }),
      headers: { "content-type": "application/json" },
    });

    const response = await handleExtractRequest(request);
    const body: unknown = await response.json();

    const bodyRecord = body && typeof body === "object" ? body : null;
    const totalFound =
      bodyRecord && typeof Reflect.get(bodyRecord, "totalFound") === "number"
        ? Reflect.get(bodyRecord, "totalFound")
        : null;
    const sourceUrl =
      bodyRecord && typeof Reflect.get(bodyRecord, "sourceUrl") === "string"
        ? Reflect.get(bodyRecord, "sourceUrl")
        : null;
    const fonts = bodyRecord ? Reflect.get(bodyRecord, "fonts") : null;
    const firstFont = Array.isArray(fonts) ? fonts[0] : null;
    const firstFamily =
      firstFont &&
      typeof firstFont === "object" &&
      typeof Reflect.get(firstFont, "family") === "string"
        ? Reflect.get(firstFont, "family")
        : null;

    expect(response.status).toBe(200);
    expect(totalFound).toBe(1);
    expect(sourceUrl).toBe("https://linear.app/");
    expect(firstFamily).toBe("Inter Variable");
  });
});
