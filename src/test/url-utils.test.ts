import {
  base64UrlDecode,
  base64UrlEncode,
  detectFontFormat,
  normalizeFamilyName,
  normalizeInputUrl,
  parseStyleValue,
  parseWeightValue,
} from "@/server/font-extractor/url-utils";

describe("url-utils", () => {
  it("normalizes url without protocol", () => {
    const url = normalizeInputUrl("linear.app");
    expect(url.toString()).toBe("https://linear.app/");
  });

  it("rejects unsupported protocol", () => {
    expect(() => normalizeInputUrl("ftp://example.com")).toThrow(
      "Only http/https URLs are supported.",
    );
  });

  it("normalizes font family quotes", () => {
    expect(normalizeFamilyName('"Inter Variable"')).toBe("Inter Variable");
  });

  it("parses weight values", () => {
    expect(parseWeightValue("400")).toBe(400);
    expect(parseWeightValue("100 900")).toBe("100 900");
    expect(parseWeightValue("normal")).toBe(400);
    expect(parseWeightValue("bold")).toBe(700);
    expect(parseWeightValue(undefined)).toBeNull();
  });

  it("parses style values", () => {
    expect(parseStyleValue("italic")).toBe("italic");
    expect(parseStyleValue("oblique")).toBe("oblique");
    expect(parseStyleValue("anything")).toBe("normal");
  });

  it("detects font format by hint and extension", () => {
    expect(detectFontFormat("https://cdn.site/font-file", "woff2")).toBe("woff2");
    expect(detectFontFormat("https://cdn.site/font-file.ttf", undefined)).toBe("ttf");
    expect(detectFontFormat("https://cdn.site/font-file", undefined)).toBe("unknown");
  });

  it("encodes and decodes base64url", () => {
    const value = "https://static.linear.app/fonts/InterVariable.woff2?v=4.1";
    const encoded = base64UrlEncode(value);
    const decoded = base64UrlDecode(encoded);

    expect(decoded).toBe(value);
  });
});
