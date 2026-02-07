import { beforeEach, afterEach, vi } from "vitest";

vi.mock("@/server/font-extractor/ssrf", () => ({
  assertSafeTargetUrl: vi.fn(async () => undefined),
}));

import { createSignedProxyUrl } from "@/server/font-extractor/proxy-signing";
import { handleFontProxyRequest } from "@/routes/api.font";
import { assertSafeTargetUrl } from "@/server/font-extractor/ssrf";

function errorMessage(value: unknown): string | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const raw = Reflect.get(value, "error");
  return typeof raw === "string" ? raw : null;
}

describe("GET /api/font", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    vi.mocked(assertSafeTargetUrl).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("rejects missing params", async () => {
    const request = new Request("http://localhost/api/font", { method: "GET" });
    const response = await handleFontProxyRequest(request);

    expect(response.status).toBe(400);
  });

  it("rejects invalid token", async () => {
    const request = new Request("http://localhost/api/font?u=a&r=b&d=0&t=invalid", {
      method: "GET",
    });

    const response = await handleFontProxyRequest(request);

    expect(response.status).toBe(403);
  });

  it("streams proxied font for valid signed request", async () => {
    const signedPath = createSignedProxyUrl({
      fontUrl: "https://static.linear.app/fonts/InterVariable.woff2",
      referer: "https://linear.app/",
      download: true,
    });

    vi.mocked(fetch).mockResolvedValue(
      new Response(new Uint8Array([1, 2, 3, 4]), {
        status: 200,
        headers: {
          "content-type": "font/woff2",
          "content-length": "4",
        },
      }),
    );

    const request = new Request(`http://localhost${signedPath}`, { method: "GET" });
    const response = await handleFontProxyRequest(request);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("font/woff2");
    expect(response.headers.get("content-disposition")).toContain("attachment");

    const buffer = await response.arrayBuffer();
    expect(buffer.byteLength).toBe(4);
  });

  it("blocks redirects to unsafe hosts", async () => {
    const signedPath = createSignedProxyUrl({
      fontUrl: "https://public.example.com/fonts/brand.woff2",
      referer: "https://public.example.com/",
      download: false,
    });

    vi.mocked(assertSafeTargetUrl).mockImplementation(async (url: URL) => {
      if (url.hostname === "localhost") {
        throw new Error("Blocked target host.");
      }
      return undefined;
    });

    vi.mocked(fetch).mockResolvedValue(
      new Response(null, {
        status: 302,
        headers: {
          location: "http://localhost/internal-font.woff2",
        },
      }),
    );

    const request = new Request(`http://localhost${signedPath}`, { method: "GET" });
    const response = await handleFontProxyRequest(request);
    const body: unknown = await response.json();

    expect(response.status).toBe(400);
    expect(errorMessage(body)).toContain("Blocked target host");
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
  });
});
