import { createFileRoute } from "@tanstack/react-router";
import type { FontStyle } from "@/features/font-snatcher/types";
import { getGoogleFontsSnapshot } from "@/server/font-extractor/google-fonts";
import { buildMatchResponse } from "@/server/font-extractor/match";

interface MatchRequestBody {
  family?: string;
  weight?: string;
  style?: FontStyle;
  url?: string;
  referer?: string;
}

function isStyle(value: unknown): value is FontStyle {
  return value === "normal" || value === "italic" || value === "oblique";
}

function isMatchRequestBody(value: unknown): value is MatchRequestBody {
  if (!value || typeof value !== "object") {
    return false;
  }

  const family = Reflect.get(value, "family");
  const weight = Reflect.get(value, "weight");
  const style = Reflect.get(value, "style");
  const url = Reflect.get(value, "url");
  const referer = Reflect.get(value, "referer");

  return (
    (family === undefined || typeof family === "string") &&
    (weight === undefined || typeof weight === "string") &&
    (style === undefined || isStyle(style)) &&
    (url === undefined || typeof url === "string") &&
    (referer === undefined || typeof referer === "string")
  );
}

function jsonError(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}

export async function handleMatchRequest(request: Request): Promise<Response> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonError("Request body must be valid JSON.", 400);
  }

  if (!isMatchRequestBody(body)) {
    return jsonError("Invalid match request payload.", 400);
  }

  const family = typeof body.family === "string" ? body.family.trim() : "";
  const weight = typeof body.weight === "string" ? body.weight.trim() : "400";
  const style = isStyle(body.style) ? body.style : "normal";

  if (family.length === 0) {
    return jsonError("Font family is required.", 400);
  }

  try {
    const catalog = await getGoogleFontsSnapshot();
    const response = buildMatchResponse({
      family,
      weight,
      style,
      catalog,
    });

    return Response.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to match alternatives.";
    return jsonError(`Failed to match alternatives: ${message}`, 500);
  }
}

export const Route = createFileRoute("/api/match")({
  server: {
    handlers: {
      POST: async ({ request }) => handleMatchRequest(request),
    },
  },
});
