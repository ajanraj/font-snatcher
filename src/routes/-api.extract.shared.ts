import { assertSafeTargetUrl } from "@/server/font-extractor/ssrf";
import { normalizeInputUrl } from "@/server/font-extractor/url-utils";

interface ExtractRequestBody {
  url?: string;
}

export interface ExtractRequestValidationSuccess {
  ok: true;
  normalizedUrl: URL;
}

export interface ExtractRequestValidationFailure {
  ok: false;
  response: Response;
}

export type ExtractRequestValidationResult =
  | ExtractRequestValidationSuccess
  | ExtractRequestValidationFailure;

function isExtractRequestBody(value: unknown): value is ExtractRequestBody {
  if (!value || typeof value !== "object") {
    return false;
  }

  const rawUrl = Reflect.get(value, "url");
  return rawUrl === undefined || typeof rawUrl === "string";
}

export function jsonError(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}

export async function validateExtractRequest(
  request: Request,
): Promise<ExtractRequestValidationResult> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return {
      ok: false,
      response: jsonError("Request body must be valid JSON.", 400),
    };
  }

  if (!isExtractRequestBody(body)) {
    return {
      ok: false,
      response: jsonError("Invalid request payload.", 400),
    };
  }

  const rawUrl = typeof body.url === "string" ? body.url : "";

  let normalizedUrl: URL;
  try {
    normalizedUrl = normalizeInputUrl(rawUrl);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid URL.";
    return {
      ok: false,
      response: jsonError(message, 400),
    };
  }

  try {
    await assertSafeTargetUrl(normalizedUrl);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unsafe target URL.";
    return {
      ok: false,
      response: jsonError(message, 400),
    };
  }

  return {
    ok: true,
    normalizedUrl,
  };
}
