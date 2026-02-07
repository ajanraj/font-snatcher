import { createFileRoute } from "@tanstack/react-router";
import { MAX_FONT_BYTES } from "@/server/font-extractor/constants";
import {
  decodeSignedProxyParams,
  verifySignedProxyParams,
} from "@/server/font-extractor/proxy-signing";
import { assertSafeTargetUrl } from "@/server/font-extractor/ssrf";
import { detectFontFormat } from "@/server/font-extractor/url-utils";

const FONT_CONTENT_TYPES = [
  "font/woff2",
  "font/woff",
  "font/ttf",
  "font/otf",
  "font/sfnt",
  "application/font-woff",
  "application/font-woff2",
  "application/font-sfnt",
  "application/octet-stream",
];

const MAX_FONT_REDIRECTS = 5;

function errorResponse(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}

function streamWithByteLimit(
  source: ReadableStream<Uint8Array>,
  maxBytes: number,
): ReadableStream<Uint8Array> {
  const reader = source.getReader();
  let total = 0;

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      const chunk = await reader.read();
      if (chunk.done) {
        controller.close();
        return;
      }

      total += chunk.value.byteLength;
      if (total > maxBytes) {
        controller.error(new Error(`Font response exceeded ${maxBytes} bytes.`));
        await reader.cancel();
        return;
      }

      controller.enqueue(chunk.value);
    },
    async cancel(reason) {
      await reader.cancel(reason);
    },
  });
}

function inferDownloadName(fontUrl: URL): string {
  const fromPath = fontUrl.pathname.split("/").at(-1);
  if (fromPath && fromPath.length > 0) {
    return fromPath;
  }

  return "font-file";
}

function isLikelyFontContentType(contentType: string, fontUrl: string): boolean {
  const normalized = contentType.toLowerCase();
  if (FONT_CONTENT_TYPES.some((allowed) => normalized.includes(allowed))) {
    return true;
  }

  const detectedFormat = detectFontFormat(fontUrl, undefined);
  return detectedFormat !== "unknown";
}

function isRedirectStatus(status: number): boolean {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}

interface SafeFontFetchResult {
  response: Response;
  finalUrl: URL;
}

async function fetchFontWithSafeRedirects(
  fontUrl: URL,
  referer: string,
): Promise<SafeFontFetchResult> {
  let currentUrl = fontUrl;

  for (let redirectCount = 0; redirectCount <= MAX_FONT_REDIRECTS; redirectCount += 1) {
    await assertSafeTargetUrl(currentUrl);

    const upstream = await fetch(currentUrl.toString(), {
      method: "GET",
      redirect: "manual",
      headers: {
        referer,
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) FontSnatcher/1.0 Safari/537.36",
        accept: "font/woff2,font/woff,font/ttf,font/otf,*/*;q=0.1",
      },
    });

    if (!isRedirectStatus(upstream.status)) {
      return {
        response: upstream,
        finalUrl: currentUrl,
      };
    }

    const location = upstream.headers.get("location");
    if (!location) {
      throw new Error("Upstream redirect missing location header.");
    }

    currentUrl = new URL(location, currentUrl);
  }

  throw new Error("Upstream redirected too many times.");
}

export async function handleFontProxyRequest(request: Request): Promise<Response> {
  const currentUrl = new URL(request.url);
  const encodedUrl = currentUrl.searchParams.get("u");
  const encodedReferer = currentUrl.searchParams.get("r");
  const token = currentUrl.searchParams.get("t");
  const downloadFlag = currentUrl.searchParams.get("d");

  if (!encodedUrl || !encodedReferer || !token || !downloadFlag) {
    return errorResponse("Missing required query parameters.", 400);
  }

  if (downloadFlag !== "0" && downloadFlag !== "1") {
    return errorResponse("Invalid download mode.", 400);
  }

  const tokenValid = verifySignedProxyParams({
    encodedUrl,
    encodedReferer,
    downloadFlag,
    token,
  });

  if (!tokenValid) {
    return errorResponse("Invalid or expired font token.", 403);
  }

  let decoded: { fontUrl: string; referer: string };
  try {
    decoded = decodeSignedProxyParams({ encodedUrl, encodedReferer });
  } catch {
    return errorResponse("Invalid encoded font params.", 400);
  }

  let fontUrl: URL;
  try {
    fontUrl = new URL(decoded.fontUrl);
  } catch {
    return errorResponse("Invalid target font URL.", 400);
  }

  let upstream: Response;
  let resolvedFontUrl: URL;
  try {
    const safeFetch = await fetchFontWithSafeRedirects(fontUrl, decoded.referer);
    upstream = safeFetch.response;
    resolvedFontUrl = safeFetch.finalUrl;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to fetch upstream font.";
    const status = message.toLowerCase().includes("blocked") ? 400 : 502;
    return errorResponse(message, status);
  }

  if (!upstream.ok || !upstream.body) {
    return errorResponse(`Unable to fetch upstream font (${upstream.status}).`, 502);
  }

  const contentType = upstream.headers.get("content-type") ?? "application/octet-stream";
  if (!isLikelyFontContentType(contentType, resolvedFontUrl.toString())) {
    return errorResponse("Upstream response is not a recognized font file.", 415);
  }

  const contentLengthHeader = upstream.headers.get("content-length");
  if (contentLengthHeader) {
    const parsedLength = Number(contentLengthHeader);
    if (Number.isFinite(parsedLength) && parsedLength > MAX_FONT_BYTES) {
      return errorResponse("Font file too large.", 413);
    }
  }

  const proxiedStream = streamWithByteLimit(upstream.body, MAX_FONT_BYTES);

  const responseHeaders = new Headers();
  responseHeaders.set("content-type", contentType);
  responseHeaders.set("cache-control", "public, max-age=600");

  const contentLength = upstream.headers.get("content-length");
  if (contentLength) {
    responseHeaders.set("content-length", contentLength);
  }

  if (downloadFlag === "1") {
    const filename = inferDownloadName(resolvedFontUrl);
    responseHeaders.set("content-disposition", `attachment; filename="${filename}"`);
  }

  return new Response(proxiedStream, {
    status: 200,
    headers: responseHeaders,
  });
}

export const Route = createFileRoute("/api/font")({
  server: {
    handlers: {
      GET: async ({ request }) => handleFontProxyRequest(request),
    },
  },
});
