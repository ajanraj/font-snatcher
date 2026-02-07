import { createFileRoute } from "@tanstack/react-router";
import { extractFontsResponse } from "@/server/font-extractor";
import { jsonError, validateExtractRequest } from "@/routes/-api.extract.shared";

export async function handleExtractFontsRequest(request: Request): Promise<Response> {
  const validated = await validateExtractRequest(request);
  if (!validated.ok) {
    return validated.response;
  }

  try {
    const response = await extractFontsResponse(validated.normalizedUrl);
    return Response.json(response);
  } catch (error) {
    const message =
      error instanceof Error
        ? `Failed to extract fonts: ${error.message}`
        : "Failed to extract fonts.";
    return jsonError(message, 500);
  }
}

export const Route = createFileRoute("/api/extract-fonts")({
  server: {
    handlers: {
      POST: async ({ request }) => handleExtractFontsRequest(request),
    },
  },
});
