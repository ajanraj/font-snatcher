import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { FONT_PROXY_TOKEN_TTL_MS } from "@/server/font-extractor/constants";
import { base64UrlDecode, base64UrlEncode } from "@/server/font-extractor/url-utils";

let cachedDevelopmentSecret: string | null = null;

interface ProxyTokenPayload {
  encodedUrl: string;
  encodedReferer: string;
  downloadFlag: "0" | "1";
  expiresAt: number;
}

function getProxySecret(): string {
  const secret = process.env.FONT_PROXY_SECRET;
  if (secret && secret.length >= 16) {
    return secret;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("FONT_PROXY_SECRET must be set to at least 16 characters.");
  }

  if (!cachedDevelopmentSecret) {
    cachedDevelopmentSecret = randomBytes(32).toString("hex");
  }

  return cachedDevelopmentSecret;
}

function signatureForPayload(payload: ProxyTokenPayload): string {
  const message = `${payload.encodedUrl}.${payload.encodedReferer}.${payload.downloadFlag}.${payload.expiresAt}`;
  return createHmac("sha256", getProxySecret()).update(message).digest("hex");
}

function encodeToken(payload: ProxyTokenPayload): string {
  const signature = signatureForPayload(payload);
  return `${payload.expiresAt}.${signature}`;
}

function secureStringEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");

  if (left.length !== right.length) {
    return false;
  }

  return timingSafeEqual(left, right);
}

export function createSignedProxyUrl(params: {
  fontUrl: string;
  referer: string;
  download: boolean;
}): string {
  const encodedUrl = base64UrlEncode(params.fontUrl);
  const encodedReferer = base64UrlEncode(params.referer);
  const downloadFlag: "0" | "1" = params.download ? "1" : "0";
  const expiresAt = Date.now() + FONT_PROXY_TOKEN_TTL_MS;

  const token = encodeToken({
    encodedUrl,
    encodedReferer,
    downloadFlag,
    expiresAt,
  });

  const query = new URLSearchParams({
    u: encodedUrl,
    r: encodedReferer,
    d: downloadFlag,
    t: token,
  });

  return `/api/font?${query.toString()}`;
}

export function verifySignedProxyParams(params: {
  encodedUrl: string;
  encodedReferer: string;
  downloadFlag: "0" | "1";
  token: string;
}): boolean {
  const dotIndex = params.token.indexOf(".");
  if (dotIndex <= 0) {
    return false;
  }

  const expiresAtRaw = params.token.slice(0, dotIndex);
  const signature = params.token.slice(dotIndex + 1);

  const expiresAt = Number(expiresAtRaw);
  if (!Number.isFinite(expiresAt)) {
    return false;
  }

  if (Date.now() > expiresAt) {
    return false;
  }

  const expectedSignature = signatureForPayload({
    encodedUrl: params.encodedUrl,
    encodedReferer: params.encodedReferer,
    downloadFlag: params.downloadFlag,
    expiresAt,
  });

  return secureStringEqual(signature, expectedSignature);
}

export function decodeSignedProxyParams(params: { encodedUrl: string; encodedReferer: string }): {
  fontUrl: string;
  referer: string;
} {
  return {
    fontUrl: base64UrlDecode(params.encodedUrl),
    referer: base64UrlDecode(params.encodedReferer),
  };
}
