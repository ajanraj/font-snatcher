import { afterEach, beforeEach, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { FontSnatcherPage } from "@/features/font-snatcher/font-snatcher-page";

class MockFontFace {
  family: string;
  source: ArrayBuffer;
  descriptors: { style?: string; weight?: string };

  constructor(
    family: string,
    source: ArrayBuffer,
    descriptors: { style?: string; weight?: string },
  ) {
    this.family = family;
    this.source = source;
    this.descriptors = descriptors;
  }

  async load(): Promise<MockFontFace> {
    return this;
  }
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json",
    },
  });
}

function fontBinaryResponse(): Response {
  return new Response(new Uint8Array([1, 2, 3, 4]), {
    status: 200,
    headers: {
      "content-type": "font/woff2",
      "content-length": "4",
    },
  });
}

function submitExtractWithUrl(url: string): void {
  fireEvent.change(screen.getByPlaceholderText("Enter website URL"), {
    target: { value: url },
  });
  fireEvent.click(screen.getByRole("button", { name: "Extract fonts from website" }));
}

function resolveRequestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") {
    return input;
  }

  if (input instanceof URL) {
    return input.toString();
  }

  return input.url;
}

describe("FontSnatcherPage", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    vi.stubGlobal("FontFace", MockFontFace);

    Object.defineProperty(document, "fonts", {
      configurable: true,
      value: {
        add: vi.fn(),
        delete: vi.fn(),
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("starts with an empty url input", () => {
    render(<FontSnatcherPage />);
    const input = screen.getByLabelText("Website URL") as HTMLInputElement;
    expect(input.value).toBe("");
  });

  it("normalizes variable weight ranges for display", async () => {
    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = resolveRequestUrl(input);

      if (url.includes("/api/extract")) {
        return jsonResponse({
          fonts: [
            {
              name: "GeistVariable.woff2",
              family: "Geist",
              format: "WOFF2",
              url: "https://cdn.example.com/geist-variable.woff2",
              weight: "1 1000",
              style: "normal",
              referer: "https://example.com/",
              previewUrl: "/api/font?preview=weight-range",
              downloadUrl: "/api/font?download=weight-range",
              licenseStatus: "unknown_or_paid",
              licenseNote: "This font might not be free to use.",
            },
          ],
          totalFound: 1,
          sourceUrl: "https://example.com/",
        });
      }

      if (url.includes("/api/font?preview=weight-range")) {
        return fontBinaryResponse();
      }

      if (url.includes("/api/match")) {
        return jsonResponse({
          original: { family: "Geist", weight: "1 1000", style: "normal" },
          method: "feature-similarity",
          features: {
            weightClass: 0.44,
            widthClass: 0.5,
            xHeightRatio: 0.54,
            capHeightRatio: 0.72,
            ascenderRatio: 0.96,
            descenderRatio: 0.24,
            avgWidthRatio: 0.64,
            serifScore: 0.21,
            contrastRatio: 0.11,
            roundness: 0.57,
            isMonospace: 0,
            italicAngle: 0,
            panoseSerif: 0,
            panoseWeight: 0.44,
            complexity: 0.38,
          },
          alternatives: [],
        });
      }

      return jsonResponse({ error: "Unhandled request" }, 500);
    });

    render(<FontSnatcherPage />);

    submitExtractWithUrl("example.com");

    await waitFor(() => {
      expect(screen.queryByText("Found 1 fonts")).not.toBeNull();
      expect(screen.queryByText("100 900")).not.toBeNull();
    });
  });

  it("applies mobile overflow guards on font card content", async () => {
    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = resolveRequestUrl(input);

      if (url.includes("/api/extract")) {
        return jsonResponse({
          fonts: [
            {
              name: "UltraExtendedBrandTypeface-VeryLongAssetName.woff2",
              family: "Ultra Extended Brand Typeface Name",
              format: "SUPERLONGFORMATWITHOUTBREAKS",
              url: "https://cdn.example.com/ultra-extended-brand-typeface.woff2",
              weight: "400",
              style: "normal",
              referer: "https://example.com/",
              previewUrl: "/api/font?preview=mobile-overflow",
              downloadUrl: "/api/font?download=mobile-overflow",
              licenseStatus: "unknown_or_paid",
              licenseNote: "This font might not be free to use.",
            },
          ],
          totalFound: 1,
          sourceUrl: "https://example.com/",
        });
      }

      if (url.includes("/api/font?preview=mobile-overflow")) {
        return fontBinaryResponse();
      }

      return jsonResponse({ error: "Unhandled request" }, 500);
    });

    render(<FontSnatcherPage />);

    submitExtractWithUrl("example.com");

    await waitFor(() => {
      expect(screen.queryByText("Found 1 fonts")).not.toBeNull();
    });

    const heading = screen.getByRole("heading", { name: "Ultra Extended Brand Typeface Name" });
    const cardArticle = heading.closest("article");
    expect(cardArticle).not.toBeNull();
    expect(cardArticle?.className).toContain("min-w-0");

    const formatBadge = screen.getByText("SUPERLONGFORMATWITHOUTBREAKS");
    expect(formatBadge.className).toContain("truncate");
    expect(formatBadge.className).toContain("max-w-[7rem]");
  });

  it("shows paid warning modal before download", async () => {
    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = resolveRequestUrl(input);

      if (url.includes("/api/extract")) {
        return jsonResponse({
          fonts: [
            {
              name: "InterVariable-Italic.woff2",
              family: "Inter Variable",
              format: "WOFF2",
              url: "https://static.linear.app/fonts/InterVariable-Italic.woff2",
              weight: "100 900",
              style: "italic",
              referer: "https://linear.app/",
              previewUrl: "/api/font?preview=1",
              downloadUrl: "/api/font?download=1",
              licenseStatus: "unknown_or_paid",
              licenseNote: "This font might not be free to use.",
            },
          ],
          totalFound: 1,
          sourceUrl: "https://linear.app/",
        });
      }

      if (url.includes("/api/font?preview=1")) {
        return fontBinaryResponse();
      }

      if (url.includes("/api/match")) {
        return jsonResponse({
          original: {
            family: "Inter Variable",
            weight: "100 900",
            style: "italic",
          },
          method: "feature-similarity",
          features: {
            weightClass: 0.44,
            widthClass: 0.5,
            xHeightRatio: 0.54,
            capHeightRatio: 0.72,
            ascenderRatio: 0.96,
            descenderRatio: 0.24,
            avgWidthRatio: 0.64,
            serifScore: 0.21,
            contrastRatio: 0.11,
            roundness: 0.57,
            isMonospace: 0,
            italicAngle: 0.21,
            panoseSerif: 0,
            panoseWeight: 0.33,
            complexity: 0.38,
          },
          alternatives: [
            {
              family: "Inter",
              category: "sans-serif",
              similarity: 86,
              reason: "86% visual match",
              downloadUrl: "https://fonts.google.com/specimen/Inter",
            },
          ],
        });
      }

      return jsonResponse({ error: "Unhandled request" }, 500);
    });

    render(<FontSnatcherPage />);

    submitExtractWithUrl("linear.app");

    await waitFor(() => {
      expect(screen.queryByText("Found 1 fonts")).not.toBeNull();
    });

    expect(screen.queryByText("This font might not be free to use.")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Download Inter Variable" }));

    await waitFor(() => {
      expect(screen.queryByText("License Warning")).not.toBeNull();
    });
  });

  it("redirects known paid fonts to license page", async () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);

    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = resolveRequestUrl(input);

      if (url.includes("/api/extract")) {
        return jsonResponse({
          fonts: [
            {
              name: "AcuminPro-Regular.woff2",
              family: "Acumin Pro",
              format: "WOFF2",
              url: "https://use.typekit.net/abc123.woff2",
              weight: "400",
              style: "normal",
              referer: "https://example.com/",
              previewUrl: "/api/font?preview=paid",
              downloadUrl: "https://helpx.adobe.com/fonts/using/font-licensing.html",
              licenseStatus: "known_paid",
              licenseNote:
                "Likely served by Adobe Fonts. Get a proper license before production use.",
              licenseUrl: "https://helpx.adobe.com/fonts/using/font-licensing.html",
            },
          ],
          totalFound: 1,
          sourceUrl: "https://example.com/",
        });
      }

      if (url.includes("/api/font?preview=paid")) {
        return fontBinaryResponse();
      }

      return jsonResponse({ error: "Unhandled request" }, 500);
    });

    render(<FontSnatcherPage />);

    submitExtractWithUrl("example.com");

    await waitFor(() => {
      expect(screen.queryByText("Found 1 fonts")).not.toBeNull();
    });

    expect(screen.queryByRole("button", { name: "Get license for Acumin Pro" })).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Get license for Acumin Pro" }));

    expect(openSpy).toHaveBeenCalledWith(
      "https://helpx.adobe.com/fonts/using/font-licensing.html",
      "_blank",
      "noopener,noreferrer",
    );
    expect(screen.queryByText("License Warning")).toBeNull();
  });

  it("loads legal alternatives on demand", async () => {
    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = resolveRequestUrl(input);

      if (url.includes("/api/extract")) {
        return jsonResponse({
          fonts: [
            {
              name: "BrandFont-Regular.woff2",
              family: "Brand Font",
              format: "WOFF2",
              url: "https://cdn.site/BrandFont-Regular.woff2",
              weight: "400",
              style: "normal",
              referer: "https://brand.site/",
              previewUrl: "/api/font?preview=2",
              downloadUrl: "/api/font?download=2",
              licenseStatus: "unknown_or_paid",
              licenseNote: "This font might not be free to use.",
            },
          ],
          totalFound: 1,
          sourceUrl: "https://brand.site/",
        });
      }

      if (url.includes("/api/font?preview=2")) {
        return fontBinaryResponse();
      }

      if (url.includes("/api/match")) {
        return jsonResponse({
          original: { family: "Brand Font", weight: "400", style: "normal" },
          method: "feature-similarity",
          features: {
            weightClass: 0.44,
            widthClass: 0.5,
            xHeightRatio: 0.54,
            capHeightRatio: 0.72,
            ascenderRatio: 0.96,
            descenderRatio: 0.24,
            avgWidthRatio: 0.64,
            serifScore: 0.21,
            contrastRatio: 0.11,
            roundness: 0.57,
            isMonospace: 0,
            italicAngle: 0,
            panoseSerif: 0,
            panoseWeight: 0.44,
            complexity: 0.38,
          },
          alternatives: [
            {
              family: "Inter",
              category: "sans-serif",
              similarity: 86,
              reason: "86% visual match",
              downloadUrl: "https://fonts.google.com/specimen/Inter",
            },
          ],
        });
      }

      return jsonResponse({ error: "Unhandled request" }, 500);
    });

    render(<FontSnatcherPage />);

    submitExtractWithUrl("brand.site");

    await waitFor(() => {
      expect(screen.queryByText("Found 1 fonts")).not.toBeNull();
    });

    fireEvent.click(screen.getByRole("button", { name: "Find legal alternatives for Brand Font" }));

    await waitFor(() => {
      expect(screen.queryByText("Inter")).not.toBeNull();
      expect(screen.queryByText("86%")).not.toBeNull();
      expect(screen.queryByText("86% visual match")).not.toBeNull();
      expect(
        screen.queryByText("These Google Fonts are free to use commercially and personally."),
      ).not.toBeNull();
    });
  });

  it("downloads free font without showing paid modal", async () => {
    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = resolveRequestUrl(input);

      if (url.includes("/api/extract")) {
        return jsonResponse({
          fonts: [
            {
              name: "Inter-Regular.woff2",
              family: "Inter",
              format: "WOFF2",
              url: "https://fonts.gstatic.com/s/inter/v18/inter.woff2",
              weight: "400",
              style: "normal",
              referer: "https://example.com/",
              previewUrl: "/api/font?preview=3",
              downloadUrl: "/api/font?download=3",
              licenseStatus: "free_open",
              licenseNote: "Open source family.",
            },
          ],
          totalFound: 1,
          sourceUrl: "https://example.com/",
        });
      }

      if (url.includes("/api/font?preview=3")) {
        return fontBinaryResponse();
      }

      return jsonResponse({ error: "Unhandled request" }, 500);
    });

    render(<FontSnatcherPage />);

    submitExtractWithUrl("example.com");

    await waitFor(() => {
      expect(screen.queryByText("Found 1 fonts")).not.toBeNull();
    });

    fireEvent.click(screen.getByRole("button", { name: "Download Inter" }));

    await waitFor(() => {
      expect(screen.queryByText("License Warning")).toBeNull();
    });
  });
});
