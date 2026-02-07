import { afterEach, beforeEach, vi } from "vitest";
import { extractFontsFromWebsite } from "@/server/font-extractor/extract-fonts";

function resolveRequestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") {
    return input;
  }

  if (input instanceof URL) {
    return input.toString();
  }

  return input.url;
}

describe("extractFontsFromWebsite dedupes src variants", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps one entry per family/style/weight and prefers woff2", async () => {
    const html = `<!doctype html><html><head><link rel="stylesheet" href="/styles.css"></head></html>`;
    const stylesheet = `
      @font-face {
        font-family: "Basel Grotesk";
        src:
          url("https://cdn.example.com/fonts/BaselGrotesk-Book.woff") format("woff"),
          url("https://cdn.example.com/fonts/BaselGrotesk-Book.woff2") format("woff2");
        font-weight: 400;
        font-style: normal;
      }
      @font-face {
        font-family: "Basel Grotesk";
        src:
          url("https://cdn.example.com/fonts/BaselGrotesk-Bold.woff") format("woff"),
          url("https://cdn.example.com/fonts/BaselGrotesk-Bold.woff2") format("woff2");
        font-weight: 700;
        font-style: normal;
      }
    `;

    vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL) => {
      const url = resolveRequestUrl(input);

      if (url === "https://stripepartners.com/") {
        return new Response(html, {
          status: 200,
          headers: { "content-type": "text/html" },
        });
      }

      if (url === "https://stripepartners.com/styles.css") {
        return new Response(stylesheet, {
          status: 200,
          headers: { "content-type": "text/css" },
        });
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    const result = await extractFontsFromWebsite(new URL("https://stripepartners.com"));

    expect(result.fonts).toHaveLength(2);
    expect(result.fonts.map((font) => font.weight)).toEqual([400, 700]);
    expect(result.fonts[0]?.format).toBe("woff2");
    expect(result.fonts[0]?.sourceUrl).toContain("BaselGrotesk-Book.woff2");
    expect(result.fonts[1]?.format).toBe("woff2");
    expect(result.fonts[1]?.sourceUrl).toContain("BaselGrotesk-Bold.woff2");
  });

  it("treats normal and 400 as the same weight variant", async () => {
    const html = `<!doctype html><html><head><link rel="stylesheet" href="/styles.css"></head></html>`;
    const stylesheet = `
      @font-face {
        font-family: "Basel Grotesk";
        src: url("https://cdn.example.com/fonts/BaselGrotesk-Book.woff") format("woff");
        font-weight: normal;
        font-style: normal;
      }
      @font-face {
        font-family: "Basel Grotesk";
        src: url("https://cdn.example.com/fonts/BaselGrotesk-Book.woff2") format("woff2");
        font-weight: 400;
        font-style: normal;
      }
    `;

    vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL) => {
      const url = resolveRequestUrl(input);
      if (url === "https://stripepartners.com/") {
        return new Response(html, {
          status: 200,
          headers: { "content-type": "text/html" },
        });
      }
      if (url === "https://stripepartners.com/styles.css") {
        return new Response(stylesheet, {
          status: 200,
          headers: { "content-type": "text/css" },
        });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });

    const result = await extractFontsFromWebsite(new URL("https://stripepartners.com"));
    expect(result.fonts).toHaveLength(1);
    expect(result.fonts[0]?.format).toBe("woff2");
    expect(result.fonts[0]?.weight).toBe(400);
  });

  it("prefers subset matching preview text over non-matching subset", async () => {
    const html = `<!doctype html><html><head><link rel="stylesheet" href="/styles.css"></head></html>`;
    const stylesheet = `
      @font-face {
        font-family: "Mynerve";
        src: url("https://cdn.example.com/fonts/Mynerve-greek.woff2") format("woff2");
        font-weight: 400;
        font-style: normal;
        unicode-range: U+370-3FF;
      }
      @font-face {
        font-family: "Mynerve";
        src: url("https://cdn.example.com/fonts/Mynerve-latin.woff2") format("woff2");
        font-weight: 400;
        font-style: normal;
        unicode-range: U+??;
      }
    `;

    vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL) => {
      const url = resolveRequestUrl(input);
      if (url === "https://stripepartners.com/") {
        return new Response(html, {
          status: 200,
          headers: { "content-type": "text/html" },
        });
      }
      if (url === "https://stripepartners.com/styles.css") {
        return new Response(stylesheet, {
          status: 200,
          headers: { "content-type": "text/css" },
        });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });

    const result = await extractFontsFromWebsite(new URL("https://stripepartners.com"));

    expect(result.fonts).toHaveLength(1);
    expect(result.fonts[0]?.sourceUrl).toContain("Mynerve-latin.woff2");
  });

  it("ignores malformed unicode-range and falls back to format priority", async () => {
    const html = `<!doctype html><html><head><link rel="stylesheet" href="/styles.css"></head></html>`;
    const stylesheet = `
      @font-face {
        font-family: "Karla";
        src: url("https://cdn.example.com/fonts/KarlaRegular.woff") format("woff");
        font-weight: 400;
        font-style: normal;
        unicode-range: U+NOTHEX;
      }
      @font-face {
        font-family: "Karla";
        src: url("https://cdn.example.com/fonts/KarlaRegular.woff2") format("woff2");
        font-weight: 400;
        font-style: normal;
        unicode-range: U+BAD-RANGE;
      }
    `;

    vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL) => {
      const url = resolveRequestUrl(input);
      if (url === "https://stripepartners.com/") {
        return new Response(html, {
          status: 200,
          headers: { "content-type": "text/html" },
        });
      }
      if (url === "https://stripepartners.com/styles.css") {
        return new Response(stylesheet, {
          status: 200,
          headers: { "content-type": "text/css" },
        });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });

    const result = await extractFontsFromWebsite(new URL("https://stripepartners.com"));

    expect(result.fonts).toHaveLength(1);
    expect(result.fonts[0]?.sourceUrl).toContain("KarlaRegular.woff2");
  });
});
