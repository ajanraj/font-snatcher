import type { FontFormat } from "@/features/font-snatcher/types";

const FONT_EXTENSION_TO_FORMAT: Record<string, FontFormat> = {
  woff2: "woff2",
  woff: "woff",
  ttf: "ttf",
  otf: "otf",
  eot: "eot",
  svg: "svg",
};

export function normalizeInputUrl(input: string): URL {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    throw new Error("Please provide a website URL.");
  }

  const hasAnyScheme = /^[a-zA-Z][a-zA-Z\d+.-]*:\/\//.test(trimmed);
  const hasHttpScheme = /^https?:\/\//i.test(trimmed);

  if (hasAnyScheme && !hasHttpScheme) {
    throw new Error("Only http/https URLs are supported.");
  }

  const candidate = hasHttpScheme ? trimmed : `https://${trimmed}`;

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    throw new Error("Invalid URL format.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only http/https URLs are supported.");
  }

  url.hash = "";

  return url;
}

export function normalizeFamilyName(rawValue: string): string {
  return rawValue.replace(/^['"]/u, "").replace(/['"]$/u, "").trim();
}

export function parseWeightValue(rawValue: string | undefined): number | string | null {
  if (!rawValue) {
    return null;
  }

  const value = rawValue.trim();
  if (value.length === 0) {
    return null;
  }

  const normalized = value.toLowerCase();
  if (normalized === "normal") {
    return 400;
  }

  if (normalized === "bold") {
    return 700;
  }

  const numeric = Number(value);
  if (Number.isFinite(numeric) && Number.isInteger(numeric)) {
    return numeric;
  }

  return value;
}

export function parseStyleValue(rawValue: string | undefined): "normal" | "italic" | "oblique" {
  const value = (rawValue ?? "").trim().toLowerCase();

  if (value === "italic") {
    return "italic";
  }

  if (value === "oblique") {
    return "oblique";
  }

  return "normal";
}

export function detectFontFormat(sourceUrl: string, formatHint: string | undefined): FontFormat {
  if (formatHint) {
    const normalized = formatHint.trim().toLowerCase();
    if (normalized.includes("woff2")) {
      return "woff2";
    }
    if (normalized.includes("woff")) {
      return "woff";
    }
    if (normalized.includes("truetype") || normalized.includes("ttf")) {
      return "ttf";
    }
    if (normalized.includes("opentype") || normalized.includes("otf")) {
      return "otf";
    }
    if (normalized.includes("embedded-opentype") || normalized.includes("eot")) {
      return "eot";
    }
    if (normalized.includes("svg")) {
      return "svg";
    }
  }

  const urlWithoutHash = sourceUrl.split("#")[0] ?? sourceUrl;
  const urlWithoutQuery = urlWithoutHash.split("?")[0] ?? urlWithoutHash;
  const extension = urlWithoutQuery.split(".").at(-1)?.toLowerCase();

  if (extension && extension in FONT_EXTENSION_TO_FORMAT) {
    return FONT_EXTENSION_TO_FORMAT[extension];
  }

  return "unknown";
}

export function base64UrlEncode(value: string): string {
  return Buffer.from(value, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export function base64UrlDecode(value: string): string {
  const restored = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = restored.length % 4;
  const normalized = padding === 0 ? restored : `${restored}${"=".repeat(4 - padding)}`;
  return Buffer.from(normalized, "base64").toString("utf8");
}
