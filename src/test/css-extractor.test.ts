import { parseCssForFonts } from "@/server/font-extractor/css-extractor";

describe("css font extraction", () => {
  it("extracts font-face urls and imports", () => {
    const css = `
      @import url("/assets/fonts.css");
      @font-face {
        font-family: "Inter Variable";
        src: local("Inter"), url("./InterVariable.woff2") format("woff2");
        font-weight: 100 900;
        font-style: italic;
      }
    `;

    const parsed = parseCssForFonts(css, "https://linear.app/styles/main.css");

    expect(parsed.importedStylesheets).toEqual(["https://linear.app/assets/fonts.css"]);
    expect(parsed.extractedFonts).toHaveLength(1);
    expect(parsed.extractedFonts[0]).toMatchObject({
      family: "Inter Variable",
      style: "italic",
      weight: "100 900",
      format: "woff2",
      sourceUrl: "https://linear.app/styles/InterVariable.woff2",
    });
  });

  it("extracts nested @font-face from media blocks", () => {
    const css = `
      @media (min-width: 1024px) {
        @font-face {
          font-family: "Berkeley Mono";
          src: url("https://static.linear.app/fonts/Berkeley-Mono-Variable.woff2") format("woff2");
          font-weight: 400;
          font-style: normal;
        }
      }
    `;

    const parsed = parseCssForFonts(css, "https://linear.app/");

    expect(parsed.extractedFonts).toHaveLength(1);
    expect(parsed.extractedFonts[0]).toMatchObject({
      family: "Berkeley Mono",
      style: "normal",
      weight: 400,
      format: "woff2",
    });
  });
});
