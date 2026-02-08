import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowSquareOut,
  Heart,
  MagnifyingGlass,
  SpinnerGap,
  Warning,
  X,
} from "@phosphor-icons/react";
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
import { ThemeToggle } from "@/features/font-snatcher/theme-toggle";
import type {
  ExtractApiFontEntry,
  ExtractApiResponse,
  MatchAlternative,
  MatchApiResponse,
} from "@/features/font-snatcher/types";

const EXAMPLE_URLS = [
  // Set 1
  "stripe.com",
  "linear.app",
  "vercel.com",
  // Set 2
  "ampcode.com",
  "figma.com",
  "github.com",
  // Set 3
  "spotify.com",
  "airbnb.com",
  "claude.ai",
  // Set 4
  "openai.com",
  "every.to",
  "raycast.com",
  // Set 5
  "arc.net",
  "framer.com",
  "supabase.com",
];

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

function openExternalInNewTab(url: string): void {
  window.open(url, "_blank", "noopener,noreferrer");
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
    licenseUrl: font.licenseUrl,
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
  const [exampleIndex, setExampleIndex] = useState(0);
  const extractRequestIdRef = useRef(0);
  const extractAbortControllerRef = useRef<AbortController | null>(null);

  const hasResults = extractState.data !== null;

  // Cycle through example sets every 3s when no results
  useEffect(() => {
    if (hasResults) return;
    const interval = setInterval(() => {
      setExampleIndex((prev) => {
        const nextSet = Math.floor(prev / 3) + 1;
        const totalSets = Math.floor(EXAMPLE_URLS.length / 3);
        return (nextSet % totalSets) * 3;
      });
    }, 3000);
    return () => clearInterval(interval);
  }, [hasResults]);

  const visibleExamples = [
    EXAMPLE_URLS[exampleIndex],
    EXAMPLE_URLS[exampleIndex + 1],
    EXAMPLE_URLS[exampleIndex + 2],
  ];

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
    if (font.licenseStatus === "known_paid") {
      openExternalInNewTab(font.licenseUrl ?? font.downloadUrl);
      return;
    }

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
    <main className="relative flex min-h-dvh flex-col bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 opacity-35" aria-hidden>
        <div className="dot-grid-bg h-full w-full" />
      </div>

      <section
        className={`relative mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 pb-16 sm:px-6 lg:px-10 ${
          hasResults ? "pt-10" : "pt-[20vh]"
        }`}
      >
        <header className="mx-auto max-w-3xl text-center">
          <p className="animate-fade-in-up text-sm uppercase tracking-[0.2em] text-muted-foreground">
            Font Discovery Tool
          </p>
          <h1 className="animate-fade-in-up-delay-1 mt-5 font-display text-balance text-6xl leading-[0.95] text-foreground sm:text-7xl">
            Discover Any Web Font
          </h1>
          {!hasResults && (
            <p className="animate-fade-in-up-delay-2 mx-auto mt-6 max-w-2xl text-pretty text-lg text-muted-foreground sm:text-xl">
              Enter any website URL to discover fonts, preview them live, download originals, and
              find free legal alternatives.
            </p>
          )}
        </header>

        <form
          onSubmit={onExtract}
          className="animate-fade-in-up-delay-2 mx-auto w-full max-w-2xl rounded-2xl border border-border bg-background p-2 shadow-md transition-shadow duration-150 ease-out hover:shadow-lg"
        >
          <div className="relative">
            <Input
              value={targetUrl}
              onChange={(event) => setTargetUrl(event.currentTarget.value)}
              placeholder="Enter website URL"
              aria-label="Website URL"
              className="h-14 rounded-xl border-0 bg-transparent px-5 pr-36 text-base shadow-none focus-visible:ring-0"
              required
            />
            <Button
              type="submit"
              className="absolute right-2 top-2 h-10 gap-2 rounded-lg bg-primary px-6 text-white transition-transform duration-75 ease-out active:scale-[0.97] hover:bg-primary/90"
              disabled={extractState.isLoading}
              aria-label="Extract fonts from website"
            >
              {extractState.isLoading ? (
                <>
                  <SpinnerGap className="h-4 w-4 animate-spin" />
                  Extracting
                </>
              ) : (
                <>
                  <MagnifyingGlass weight="bold" className="h-4 w-4" />
                  Extract
                </>
              )}
            </Button>
          </div>
        </form>

        {!hasResults && (
          <div className="animate-fade-in-up-delay-2 mx-auto -mt-4 text-sm text-muted-foreground">
            <div className="flex items-center justify-center">
              <span className="mr-1.5">Try</span>
              <div className="relative h-5 w-[240px]">
                <AnimatePresence mode="popLayout">
                  <motion.div
                    key={`set-${exampleIndex}`}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
                    className="absolute inset-0 flex items-center gap-2"
                  >
                    {visibleExamples.map((example) => (
                      <button
                        key={example}
                        type="button"
                        className="whitespace-nowrap underline underline-offset-2 transition-colors duration-100 hover:text-accent-foreground"
                        onClick={() => setTargetUrl(example)}
                      >
                        {example}
                      </button>
                    ))}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </div>
        )}

        <AnimatePresence>
          {extractState.error ? (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              role="alert"
              aria-live="assertive"
              className="mx-auto flex w-full max-w-3xl items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-400"
            >
              <Warning weight="fill" className="h-5 w-5 shrink-0" />
              {extractState.error}
            </motion.div>
          ) : null}
        </AnimatePresence>

        {extractState.data && (
          <section className="animate-fade-in-up space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
                  Found {extractState.data.totalFound} fonts
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setExtractState({ isLoading: false, error: null, data: null });
                    setTargetUrl("");
                    setAlternativesOpenIds(new Set());
                    setAlternativesByFontId({});
                  }}
                  className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors duration-100 ease-out hover:bg-accent hover:text-accent-foreground"
                  aria-label="Clear results"
                >
                  <X weight="bold" className="h-3 w-3" />
                  Clear
                </button>
              </div>
              <p className="text-xs text-muted-foreground">{extractState.data.sourceUrl}</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {fonts.map((font, index) => (
                <div
                  key={font.id}
                  className="animate-fade-in-up"
                  style={{
                    animationDelay: `${Math.min(index * 40, 200)}ms`,
                  }}
                >
                  <FontCard
                    font={font}
                    alternatives={alternativesByFontId[font.id] ?? []}
                    alternativesOpen={alternativesOpenIds.has(font.id)}
                    alternativesLoading={alternativesLoadingIds.has(font.id)}
                    onToggleAlternatives={onToggleAlternatives}
                    onRequestDownload={onRequestDownload}
                  />
                </div>
              ))}
            </div>
          </section>
        )}
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
      <footer className="relative mt-auto border-t border-border/50 bg-muted/50 px-4 py-10 sm:px-6 lg:px-10">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-3">
              <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Supported Formats
              </h4>
              <div className="flex flex-wrap gap-2">
                {["WOFF2", "WOFF", "TTF", "OTF"].map((format) => (
                  <span
                    key={format}
                    className="rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground/80"
                  >
                    {format}
                  </span>
                ))}
              </div>
            </div>

            <div className="space-y-3 lg:col-span-2">
              <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Usage Guidelines
              </h4>
              <div className="space-y-2 text-xs leading-relaxed text-muted-foreground">
                <p>
                  This tool inspects publicly served font assets for research and testing. It reads
                  what your browser already receives. No protection bypassed, no private files
                  accessed.
                </p>
                <p>
                  Fonts are often licensed. Downloading doesn't grant usage rights.{" "}
                  <span className="font-medium text-foreground/80">
                    Verify your license before using any font in production.
                  </span>
                </p>
              </div>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-6">
            <p className="text-xs text-muted-foreground">
              © 2026{" "}
              <a
                href="https://ajanraj.com?utm_source=font-snatcher&utm_medium=footer&utm_campaign=projects"
                target="_blank"
                rel="noreferrer"
                className="font-medium text-foreground/80 underline-offset-2 transition-colors duration-100 hover:underline"
              >
                Ajan Raj
              </a>
              . Open source{" "}
              <Heart className="inline-block h-3 w-3 align-[-1px] text-muted-foreground/70" /> on{" "}
              <a
                href="https://github.com/ajanraj/font-snatcher"
                target="_blank"
                rel="noreferrer"
                className="font-medium text-foreground/80 underline-offset-2 transition-colors duration-100 hover:underline"
              >
                GitHub
              </a>
              .
            </p>
            <div className="flex items-center gap-4">
              <ThemeToggle />
              <a
                href="https://oschat.ai?utm_source=font-snatcher&utm_medium=footer&utm_campaign=projects"
                target="_blank"
                rel="noreferrer"
                className="group flex items-center gap-1.5 text-xs text-muted-foreground transition-colors duration-100 hover:text-accent-foreground"
              >
                <span>
                  Also check out{" "}
                  <span className="font-medium text-foreground/80 underline-offset-2 group-hover:underline">
                    OS Chat
                  </span>
                  , open-source AI assistant with 50+ models
                </span>
                <ArrowSquareOut
                  weight="bold"
                  className="h-3 w-3 shrink-0 opacity-50 transition-opacity group-hover:opacity-100"
                />
              </a>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
