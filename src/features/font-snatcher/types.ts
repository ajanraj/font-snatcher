export type FontStyle = "normal" | "italic" | "oblique";

export type FontLicenseStatus = "free_open" | "unknown_or_paid";

export type FontFormat = "woff2" | "woff" | "ttf" | "otf" | "eot" | "svg" | "unknown";

export interface AlternativeCandidate {
  family: string;
  score: number;
  category: string;
  googleFontsUrl: string;
}

export interface GoogleFontCatalogEntry {
  family: string;
  category: string;
  styles: FontStyle[];
  weights: number[];
  subsets: string[];
}

export interface ExtractedFont {
  id: string;
  family: string;
  style: FontStyle;
  weight: number | string | null;
  format: FontFormat;
  sourceUrl: string;
  sourceHost: string;
  previewUrl: string;
  downloadUrl: string;
  licenseStatus: FontLicenseStatus;
  licenseNote: string;
  alternatives: AlternativeCandidate[];
}

export interface ExtractApiFontEntry {
  name: string;
  family: string;
  format: string;
  url: string;
  weight: string;
  style: FontStyle;
  referer: string;
  previewUrl?: string;
  downloadUrl?: string;
  licenseStatus?: FontLicenseStatus;
  licenseNote?: string;
}

export interface ExtractApiResponse {
  fonts: ExtractApiFontEntry[];
  totalFound: number;
  sourceUrl: string;
}

export interface MatchFeatures {
  weightClass: number;
  widthClass: number;
  xHeightRatio: number;
  capHeightRatio: number;
  ascenderRatio: number;
  descenderRatio: number;
  avgWidthRatio: number;
  serifScore: number;
  contrastRatio: number;
  roundness: number;
  isMonospace: number;
  italicAngle: number;
  panoseSerif: number;
  panoseWeight: number;
  complexity: number;
}

export interface MatchAlternative {
  family: string;
  category: string;
  similarity: number;
  reason: string;
  downloadUrl: string;
}

export interface MatchApiResponse {
  original: {
    family: string;
    weight: string;
    style: FontStyle;
  };
  method: "feature-similarity";
  features: MatchFeatures;
  alternatives: MatchAlternative[];
}

export interface ExtractFontsResponse {
  site: {
    inputUrl: string;
    normalizedUrl: string;
    referer: string;
    durationMs: number;
    warnings: string[];
  };
  stats: {
    stylesheetCount: number;
    fontFaceCount: number;
    uniqueFontCount: number;
  };
  fonts: ExtractedFont[];
}

export interface ExtractFontsRequest {
  url: string;
}

export interface ExtractedFontSource {
  family: string;
  style: FontStyle;
  weight: number | string | null;
  format: FontFormat;
  sourceUrl: string;
}
