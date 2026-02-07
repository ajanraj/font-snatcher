import { createFileRoute } from "@tanstack/react-router";
import { extractApiResponse } from "@/server/font-extractor";
import { jsonError, validateExtractRequest } from "@/routes/-api.extract.shared";

export async function handleExtractRequest(request: Request): Promise<Response> {
  const validated = await validateExtractRequest(request);
  if (!validated.ok) {
    return validated.response;
  }

  try {
    const response = await extractApiResponse(validated.normalizedUrl);
    return Response.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to extract fonts.";
    return jsonError(`Failed to extract fonts: ${message}`, 500);
  }
}

export const Route = createFileRoute("/api/extract")({
  server: {
    handlers: {
      POST: async ({ request }) => handleExtractRequest(request),
    },
  },
});
