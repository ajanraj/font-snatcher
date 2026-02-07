import { afterEach, beforeEach, vi } from "vitest";
import { extractFontsFromWebsite } from "@/server/font-extractor/extract-fonts";
import { MAX_CSS_BYTES, MAX_HTML_BYTES } from "@/server/font-extractor/constants";

function resolveRequestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") {
    return input;
  }

  if (input instanceof URL) {
    return input.toString();
  }

  return input.url;
}

describe("extractFontsFromWebsite HTML size handling", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("truncates oversized HTML and continues extraction", async () => {
    const oversizedHtml = `<!doctype html><html><head><link rel="stylesheet" href="/styles.css">${" ".repeat(
      MAX_HTML_BYTES + 500_000,
    )}</head><body></body></html>`;

    const stylesheet = `
      @font-face {
        font-family: "Inter Variable";
        src: url("https://static.linear.app/fonts/InterVariable.woff2?v=4.1") format("woff2");
        font-style: italic;
        font-weight: 100 900;
      }
    `;

    vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL) => {
      const url = resolveRequestUrl(input);

      if (url === "https://linear.app/") {
        return new Response(oversizedHtml, {
          status: 200,
          headers: { "content-type": "text/html" },
        });
      }

      if (url === "https://linear.app/styles.css") {
        return new Response(stylesheet, {
          status: 200,
          headers: { "content-type": "text/css" },
        });
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    const result = await extractFontsFromWebsite(new URL("https://linear.app"));

    expect(result.fonts).toHaveLength(1);
    expect(result.fonts[0]?.family).toBe("Inter Variable");
    expect(result.warnings.some((warning) => warning.includes("Truncated HTML"))).toBe(true);
  });

  it("truncates oversized stylesheet and keeps extracting", async () => {
    const html = `<!doctype html><html><head><link rel="stylesheet" href="/styles.css"></head><body></body></html>`;
    const stylesheet =
      `
      @font-face {
        font-family: "Inter Variable";
        src: url("https://static.linear.app/fonts/InterVariable.woff2?v=4.1") format("woff2");
        font-style: normal;
        font-weight: 400;
      }
    ` + " ".repeat(MAX_CSS_BYTES + 200_000);

    vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL) => {
      const url = resolveRequestUrl(input);

      if (url === "https://linear.app/") {
        return new Response(html, {
          status: 200,
          headers: { "content-type": "text/html" },
        });
      }

      if (url === "https://linear.app/styles.css") {
        return new Response(stylesheet, {
          status: 200,
          headers: { "content-type": "text/css" },
        });
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    const result = await extractFontsFromWebsite(new URL("https://linear.app"));
    expect(result.fonts.length).toBeGreaterThan(0);
    expect(result.warnings.some((warning) => warning.includes("Truncated stylesheet"))).toBe(true);
  });

  it("skips unsafe imported stylesheet targets", async () => {
    const html = `
      <!doctype html>
      <html>
        <head>
          <style>
            @import "http://localhost/private.css";
          </style>
          <link rel="stylesheet" href="/styles.css">
        </head>
      </html>
    `;
    const stylesheet = `
      @font-face {
        font-family: "Inter Variable";
        src: url("https://static.linear.app/fonts/InterVariable.woff2?v=4.1") format("woff2");
        font-style: normal;
        font-weight: 400;
      }
    `;

    vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL) => {
      const url = resolveRequestUrl(input);
      if (url === "https://linear.app/") {
        return new Response(html, {
          status: 200,
          headers: { "content-type": "text/html" },
        });
      }

      if (url === "https://linear.app/styles.css") {
        return new Response(stylesheet, {
          status: 200,
          headers: { "content-type": "text/css" },
        });
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    const result = await extractFontsFromWebsite(new URL("https://linear.app"));
    expect(result.fonts).toHaveLength(1);
    expect(result.warnings.some((warning) => warning.includes("Skipped unsafe stylesheet"))).toBe(
      true,
    );
  });
});
