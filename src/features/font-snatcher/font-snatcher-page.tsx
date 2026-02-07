import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FontCard, type FontCardModel } from "@/features/font-snatcher/font-card";
import type {
  ExtractApiFontEntry,
  ExtractApiResponse,
  MatchAlternative,
  MatchApiResponse,
} from "@/features/font-snatcher/types";

const EXAMPLE_URLS = ["stripe.com", "linear.app", "vercel.com"];

interface ExtractState {
  isLoading: boolean;
  error: string | null;
  data: ExtractApiResponse | null;
}

function isExtractApiResponse(value: unknown): value is ExtractApiResponse {
  if (!value || typeof value !== "object") {
    return false;
  }

  const fonts = Reflect.get(value, "fonts");
  const totalFound = Reflect.get(value, "totalFound");
  const sourceUrl = Reflect.get(value, "sourceUrl");

  return Array.isArray(fonts) && typeof totalFound === "number" && typeof sourceUrl === "string";
}

function isMatchApiResponse(value: unknown): value is MatchApiResponse {
  if (!value || typeof value !== "object") {
    return false;
  }

  const alternatives = Reflect.get(value, "alternatives");
  const method = Reflect.get(value, "method");

  return method === "feature-similarity" && Array.isArray(alternatives);
}

function parseErrorMessage(value: unknown): string | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const errorValue = Reflect.get(value, "error");
  if (typeof errorValue === "string") {
    return errorValue;
  }

  return null;
}

function normalizeWeightLabel(weight: string): string {
  const trimmed = weight.trim();
  if (trimmed.length === 0) {
    return "400";
  }

  const lower = trimmed.toLowerCase();
  if (lower === "normal") {
    return "400";
  }
  if (lower === "bold") {
    return "700";
  }

  const numericPieces = trimmed
    .split(/\s+/u)
    .map((part) => Number.parseInt(part, 10))
    .filter((part) => Number.isFinite(part));

  if (numericPieces.length === 0) {
    return trimmed;
  }

  const clampWeight = (value: number): number => Math.min(900, Math.max(100, value));

  if (numericPieces.length === 1) {
    return String(clampWeight(numericPieces[0]));
  }

  const minimum = clampWeight(Math.min(...numericPieces));
  const maximum = clampWeight(Math.max(...numericPieces));
  return minimum === maximum ? String(minimum) : `${minimum} ${maximum}`;
}

function openDownload(downloadUrl: string): void {
  window.location.assign(downloadUrl);
}

function toCardModel(font: ExtractApiFontEntry, index: number): FontCardModel {
  return {
    id: `${font.family.toLowerCase().replace(/\s+/g, "-")}-${index + 1}`,
    name: font.name,
    family: font.family,
    format: font.format,
    url: font.url,
    weight: normalizeWeightLabel(font.weight),
    style: font.style,
    referer: font.referer,
    previewUrl: font.previewUrl ?? font.url,
    downloadUrl: font.downloadUrl ?? font.url,
    licenseStatus: font.licenseStatus ?? "unknown_or_paid",
    licenseNote:
      font.licenseNote ??
      "This font might not be free to use. Download and usage are at your own risk.",
  };
}

function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === "AbortError") ||
    (error instanceof Error && error.name === "AbortError")
  );
}

async function fetchExtractedFonts(url: string, signal: AbortSignal): Promise<ExtractApiResponse> {
  const response = await fetch("/api/extract", {
    method: "POST",
    signal,
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ url }),
  });

  const parsed = await response.json();

  if (!response.ok) {
    throw new Error(parseErrorMessage(parsed) ?? `Extraction failed (${response.status}).`);
  }

  if (!isExtractApiResponse(parsed)) {
    throw new Error("Invalid extraction response payload.");
  }

  return parsed;
}

async function fetchAlternatives(font: FontCardModel): Promise<MatchAlternative[]> {
  const response = await fetch("/api/match", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      family: font.family,
      weight: font.weight,
      style: font.style,
      url: font.url,
      referer: font.referer,
    }),
  });

  const parsed = await response.json();

  if (!response.ok) {
    throw new Error(parseErrorMessage(parsed) ?? `Match failed (${response.status}).`);
  }

  if (!isMatchApiResponse(parsed)) {
    throw new Error("Invalid match response payload.");
  }

  return parsed.alternatives;
}

export function FontSnatcherPage() {
  const [targetUrl, setTargetUrl] = useState<string>("");
  const [extractState, setExtractState] = useState<ExtractState>({
    isLoading: false,
    error: null,
    data: null,
  });
  const [alternativesOpenIds, setAlternativesOpenIds] = useState<Set<string>>(new Set());
  const [alternativesByFontId, setAlternativesByFontId] = useState<
    Record<string, MatchAlternative[]>
  >({});
  const [alternativesLoadingIds, setAlternativesLoadingIds] = useState<Set<string>>(new Set());
  const [pendingPaidDownload, setPendingPaidDownload] = useState<FontCardModel | null>(null);
  const extractRequestIdRef = useRef(0);
  const extractAbortControllerRef = useRef<AbortController | null>(null);

  const fonts = useMemo<FontCardModel[]>(() => {
    if (!extractState.data) {
      return [];
    }

    return extractState.data.fonts.map((font, index) => toCardModel(font, index));
  }, [extractState.data]);

  useEffect(() => {
    return () => {
      extractAbortControllerRef.current?.abort();
    };
  }, []);

  const onExtract = async (event: FormEvent) => {
    event.preventDefault();
    extractAbortControllerRef.current?.abort();
    const controller = new AbortController();
    extractAbortControllerRef.current = controller;
    const requestId = extractRequestIdRef.current + 1;
    extractRequestIdRef.current = requestId;

    setExtractState({
      isLoading: true,
      error: null,
      data: null,
    });
    setAlternativesOpenIds(new Set());
    setAlternativesByFontId({});
    setAlternativesLoadingIds(new Set());

    try {
      const data = await fetchExtractedFonts(targetUrl, controller.signal);
      if (extractRequestIdRef.current !== requestId) {
        return;
      }
      setExtractState({
        isLoading: false,
        error: null,
        data,
      });
    } catch (error) {
      if (isAbortError(error)) {
        return;
      }
      if (extractRequestIdRef.current !== requestId) {
        return;
      }
      const message = error instanceof Error ? error.message : "Failed to extract fonts.";
      setExtractState({
        isLoading: false,
        error: message,
        data: null,
      });
    } finally {
      if (extractRequestIdRef.current === requestId) {
        extractAbortControllerRef.current = null;
      }
    }
  };

  const onToggleAlternatives = (font: FontCardModel, nextOpen: boolean) => {
    const nextSet = new Set(alternativesOpenIds);
    if (nextOpen) {
      nextSet.add(font.id);
    } else {
      nextSet.delete(font.id);
    }
    setAlternativesOpenIds(nextSet);

    if (!nextOpen || alternativesByFontId[font.id]) {
      return;
    }

    const nextLoading = new Set(alternativesLoadingIds);
    nextLoading.add(font.id);
    setAlternativesLoadingIds(nextLoading);
    const snapshotRequestId = extractRequestIdRef.current;

    fetchAlternatives(font)
      .then((alternatives) => {
        if (extractRequestIdRef.current !== snapshotRequestId) {
          return;
        }
        setAlternativesByFontId((previous) => ({
          ...previous,
          [font.id]: alternatives,
        }));
      })
      .catch(() => {
        if (extractRequestIdRef.current !== snapshotRequestId) {
          return;
        }
        setAlternativesByFontId((previous) => ({
          ...previous,
          [font.id]: [],
        }));
      })
      .finally(() => {
        if (extractRequestIdRef.current !== snapshotRequestId) {
          return;
        }
        setAlternativesLoadingIds((previous) => {
          const updated = new Set(previous);
          updated.delete(font.id);
          return updated;
        });
      });
  };

  const onRequestDownload = (font: FontCardModel) => {
    if (font.licenseStatus === "unknown_or_paid") {
      setPendingPaidDownload(font);
      return;
    }

    openDownload(font.downloadUrl);
  };

  const confirmPaidDownload = () => {
    if (pendingPaidDownload) {
      openDownload(pendingPaidDownload.downloadUrl);
    }
    setPendingPaidDownload(null);
  };

  return (
    <main className="relative min-h-dvh bg-white text-slate-900">
      <div className="pointer-events-none absolute inset-0 opacity-35" aria-hidden>
        <div className="dot-grid-bg h-full w-full" />
      </div>

      <section className="relative mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 pb-16 pt-14 sm:px-6 lg:px-10">
        <header className="mx-auto max-w-3xl text-center">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Font Discovery Tool</p>
          <h1 className="mt-4 font-display text-balance text-5xl leading-[0.95] text-[#0f1b3d] sm:text-6xl">
            Discover Any Web Font
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-pretty text-base text-slate-600 sm:text-lg">
            Enter any website URL to discover fonts, preview them live, download originals, and find
            free legal alternatives.
          </p>
        </header>

        <form
          onSubmit={onExtract}
          className="mx-auto w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-1.5 shadow-md"
        >
          <div className="relative">
            <Input
              value={targetUrl}
              onChange={(event) => setTargetUrl(event.currentTarget.value)}
              placeholder="Enter website URL"
              aria-label="Website URL"
              className="h-12 rounded-xl border-0 bg-transparent px-4 pr-32 text-sm shadow-none focus-visible:ring-0"
              required
            />
            <Button
              type="submit"
              className="absolute right-1.5 top-1.5 h-9 rounded-lg bg-[#0f1b3d] px-5 text-white hover:bg-[#182a5c]"
              disabled={extractState.isLoading}
              aria-label="Extract fonts from website"
            >
              {extractState.isLoading ? "Extracting..." : "Extract"}
            </Button>
          </div>
        </form>
        <div className="mx-auto -mt-5 flex w-full max-w-xl flex-wrap items-center justify-center gap-2 text-xs text-slate-500">
          <span>Try</span>
          {EXAMPLE_URLS.map((example) => (
            <button
              key={example}
              type="button"
              className="underline underline-offset-2 hover:text-slate-700"
              onClick={() => setTargetUrl(example)}
            >
              {example}
            </button>
          ))}
        </div>

        {extractState.error ? (
          <div
            role="alert"
            aria-live="assertive"
            className="mx-auto w-full max-w-3xl rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
          >
            {extractState.error}
          </div>
        ) : null}

        {extractState.data ? (
          <section className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-medium uppercase tracking-wide text-slate-600">
                Found {extractState.data.totalFound} fonts
              </p>
              <p className="text-xs text-slate-500">{extractState.data.sourceUrl}</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {fonts.map((font) => (
                <FontCard
                  key={font.id}
                  font={font}
                  alternatives={alternativesByFontId[font.id] ?? []}
                  alternativesOpen={alternativesOpenIds.has(font.id)}
                  alternativesLoading={alternativesLoadingIds.has(font.id)}
                  onToggleAlternatives={onToggleAlternatives}
                  onRequestDownload={onRequestDownload}
                />
              ))}
            </div>
          </section>
        ) : null}
      </section>

      <AlertDialog
        open={pendingPaidDownload !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingPaidDownload(null);
          }
        }}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>License Warning</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingPaidDownload?.licenseNote ??
                "This font may be paid or restricted. Download and usage are at your own risk."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmPaidDownload}>Download Anyway</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
