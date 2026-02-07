import { isIP } from "node:net";
import { lookup } from "node:dns/promises";

const BLOCKED_HOST_SUFFIXES = [".local", ".localhost", ".internal", ".test"];

export function isBlockedHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase();

  if (normalized === "localhost") {
    return true;
  }

  return BLOCKED_HOST_SUFFIXES.some((suffix) => normalized.endsWith(suffix));
}

export function isPrivateIpAddress(ipAddress: string): boolean {
  const ipVersion = isIP(ipAddress);
  if (ipVersion === 4) {
    return isPrivateIpv4(ipAddress);
  }

  if (ipVersion === 6) {
    return isPrivateIpv6(ipAddress);
  }

  return true;
}

function isPrivateIpv4(address: string): boolean {
  const segments = address.split(".").map((segment) => Number(segment));
  if (segments.length !== 4 || segments.some((segment) => Number.isNaN(segment))) {
    return true;
  }

  const [a, b] = segments;

  if (a === 0 || a === 10 || a === 127) {
    return true;
  }

  if (a === 100 && b >= 64 && b <= 127) {
    return true;
  }

  if (a === 169 && b === 254) {
    return true;
  }

  if (a === 172 && b >= 16 && b <= 31) {
    return true;
  }

  if (a === 192 && (b === 0 || b === 168)) {
    return true;
  }

  if (a === 198 && (b === 18 || b === 19 || b === 51)) {
    return true;
  }

  if (a === 203 && b === 0) {
    return true;
  }

  if (a >= 224) {
    return true;
  }

  return false;
}

function isPrivateIpv6(address: string): boolean {
  const normalized = address.toLowerCase();

  if (
    normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("fe80:") ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd")
  ) {
    return true;
  }

  if (normalized.startsWith("::ffff:")) {
    const maybeV4 = normalized.slice("::ffff:".length);
    return isPrivateIpv4(maybeV4);
  }

  return false;
}

export async function assertSafeTargetUrl(url: URL): Promise<void> {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only http/https URLs are allowed.");
  }

  if (isBlockedHostname(url.hostname)) {
    throw new Error("Blocked target host.");
  }

  const hostnameIpVersion = isIP(url.hostname);
  if (hostnameIpVersion !== 0) {
    if (isPrivateIpAddress(url.hostname)) {
      throw new Error("Blocked private target IP.");
    }
    return;
  }

  const dnsRecords = await lookup(url.hostname, { all: true });
  if (dnsRecords.length === 0) {
    throw new Error("Unable to resolve target host.");
  }

  for (const record of dnsRecords) {
    if (isPrivateIpAddress(record.address)) {
      throw new Error("Blocked private target IP.");
    }
  }
}
