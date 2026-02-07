const BLOCKED_HOST_SUFFIXES = [".local", ".localhost", ".internal", ".test"];
const DNS_CACHE_TTL_MS = 5 * 60 * 1000;

interface DnsCacheEntry {
  addresses: string[];
  expiresAt: number;
}

const dnsCache = new Map<string, DnsCacheEntry>();

export function isBlockedHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase();

  if (normalized === "localhost") {
    return true;
  }

  return BLOCKED_HOST_SUFFIXES.some((suffix) => normalized.endsWith(suffix));
}

function isValidIpv4(address: string): boolean {
  const segments = address.split(".");
  if (segments.length !== 4) {
    return false;
  }

  for (const segment of segments) {
    if (segment.length === 0 || !/^\d+$/u.test(segment)) {
      return false;
    }

    const parsed = Number(segment);
    if (!Number.isInteger(parsed) || parsed < 0 || parsed > 255) {
      return false;
    }
  }

  return true;
}

function isHexGroup(segment: string): boolean {
  return /^[0-9a-f]{1,4}$/iu.test(segment);
}

function isValidIpv6(address: string): boolean {
  const normalized = address.toLowerCase();
  if (normalized.length === 0) {
    return false;
  }

  const doubleColonMatches = normalized.match(/::/gu);
  if (doubleColonMatches && doubleColonMatches.length > 1) {
    return false;
  }

  const hasDoubleColon = normalized.includes("::");
  const [leftRaw, rightRaw] = normalized.split("::");

  const left = leftRaw.length > 0 ? leftRaw.split(":") : [];
  const right = rightRaw && rightRaw.length > 0 ? rightRaw.split(":") : [];

  const hasIpv4Tail = right.length > 0 && isValidIpv4(right[right.length - 1]);
  const hextetCountLeft = left.filter((segment) => segment.length > 0).length;
  const hextetCountRight = right.filter((segment) => segment.length > 0).length;
  const ipV4HextetEquivalent = hasIpv4Tail ? 2 : 0;

  if (!left.every(isHexGroup)) {
    return false;
  }

  if (
    !right.every((segment, index) => {
      if (hasIpv4Tail && index === right.length - 1) {
        return true;
      }
      return isHexGroup(segment);
    })
  ) {
    return false;
  }

  const totalHextets = hextetCountLeft + hextetCountRight + ipV4HextetEquivalent;
  if (hasDoubleColon) {
    return totalHextets < 8;
  }

  return totalHextets === 8;
}

function detectIpVersion(address: string): 0 | 4 | 6 {
  if (isValidIpv4(address)) {
    return 4;
  }

  if (isValidIpv6(address)) {
    return 6;
  }

  return 0;
}

export function isPrivateIpAddress(ipAddress: string): boolean {
  const ipVersion = detectIpVersion(ipAddress);
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

interface DnsJsonAnswer {
  data?: unknown;
  type?: unknown;
}

interface DnsJsonResponse {
  Answer?: unknown;
}

function isDnsAnswer(value: unknown): value is DnsJsonAnswer {
  if (!value || typeof value !== "object") {
    return false;
  }

  const data = Reflect.get(value, "data");
  return data === undefined || typeof data === "string";
}

function isDnsJsonResponse(value: unknown): value is DnsJsonResponse {
  if (!value || typeof value !== "object") {
    return false;
  }

  const answer = Reflect.get(value, "Answer");
  return answer === undefined || Array.isArray(answer);
}

async function resolveViaDnsOverHttps(
  hostname: string,
  recordType: "A" | "AAAA",
): Promise<string[]> {
  const endpoint = new URL("https://cloudflare-dns.com/dns-query");
  endpoint.searchParams.set("name", hostname);
  endpoint.searchParams.set("type", recordType);

  const response = await fetch(endpoint.toString(), {
    method: "GET",
    headers: {
      accept: "application/dns-json",
    },
  });

  if (!response.ok) {
    return [];
  }

  const parsed: unknown = await response.json();
  if (!isDnsJsonResponse(parsed)) {
    return [];
  }

  const answers = Array.isArray(parsed.Answer) ? parsed.Answer : [];
  const records: string[] = [];

  for (const item of answers) {
    if (!isDnsAnswer(item)) {
      continue;
    }

    const data = Reflect.get(item, "data");
    if (typeof data !== "string") {
      continue;
    }

    const maybeIpVersion = detectIpVersion(data);
    if (maybeIpVersion === 4 || maybeIpVersion === 6) {
      records.push(data);
    }
  }

  return records;
}

async function resolvePublicIps(hostname: string): Promise<string[]> {
  const cached = dnsCache.get(hostname);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.addresses;
  }

  const [aRecords, aaaaRecords] = await Promise.all([
    resolveViaDnsOverHttps(hostname, "A"),
    resolveViaDnsOverHttps(hostname, "AAAA"),
  ]);

  const addresses = [...aRecords, ...aaaaRecords];
  dnsCache.set(hostname, {
    addresses,
    expiresAt: Date.now() + DNS_CACHE_TTL_MS,
  });

  return addresses;
}

export async function assertSafeTargetUrl(url: URL): Promise<void> {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only http/https URLs are allowed.");
  }

  if (isBlockedHostname(url.hostname)) {
    throw new Error("Blocked target host.");
  }

  const hostnameIpVersion = detectIpVersion(url.hostname);
  if (hostnameIpVersion !== 0) {
    if (isPrivateIpAddress(url.hostname)) {
      throw new Error("Blocked private target IP.");
    }
    return;
  }

  const dnsAddresses = await resolvePublicIps(url.hostname);
  if (dnsAddresses.length === 0) {
    throw new Error("Unable to resolve target host.");
  }

  for (const address of dnsAddresses) {
    if (isPrivateIpAddress(address)) {
      throw new Error("Blocked private target IP.");
    }
  }
}
