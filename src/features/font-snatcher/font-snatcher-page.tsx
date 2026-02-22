import { useEffect, useMemo, useReducer, useRef } from "react";
import type { FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { AnimatePresence, LazyMotion, domMax, m } from "motion/react";
import { ArrowSquareOut, Warning } from "@phosphor-icons/react";
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
import type { FontCardModel } from "@/features/font-snatcher/font-card";
import {
  type ExtractState,
  fetchAlternatives,
  fetchExtractedFonts,
  isAbortError,
  openDownload,
  openExternalInNewTab,
  toCardModel,
} from "@/features/font-snatcher/font-api";
import {
  fadeUp,
  footerVariants,
  gentleSpring,
  heroStagger,
} from "@/features/font-snatcher/motion-variants";
import { ResultsSection } from "@/features/font-snatcher/results-section";
import { SearchForm } from "@/features/font-snatcher/search-form";
import { ThemeToggle } from "@/features/font-snatcher/theme-toggle";
import type { ExtractApiResponse, MatchAlternative } from "@/features/font-snatcher/types";

interface AlternativesState {
  openIds: Set<string>;
  byFontId: Record<string, MatchAlternative[]>;
  loadingIds: Set<string>;
}

interface PageState {
  targetUrl: string;
  extractState: ExtractState;
  alternatives: AlternativesState;
  pendingPaidDownload: FontCardModel | null;
}

type PageAction =
  | { type: "target-url-set"; targetUrl: string }
  | { type: "extract-started" }
  | { type: "extract-succeeded"; data: ExtractApiResponse }
  | { type: "extract-failed"; error: string }
  | { type: "alternatives-toggled"; fontId: string; nextOpen: boolean }
  | { type: "alternatives-loading-started"; fontId: string }
  | { type: "alternatives-loaded"; fontId: string; alternatives: MatchAlternative[] }
  | { type: "alternatives-loading-finished"; fontId: string }
  | { type: "pending-paid-set"; font: FontCardModel | null }
  | { type: "results-cleared" };

const emptyExtractState: ExtractState = {
  isLoading: false,
  error: null,
  data: null,
};

function createEmptyAlternativesState(): AlternativesState {
  return {
    openIds: new Set(),
    byFontId: {},
    loadingIds: new Set(),
  };
}

function pageReducer(state: PageState, action: PageAction): PageState {
  if (action.type === "target-url-set") {
    return { ...state, targetUrl: action.targetUrl };
  }

  if (action.type === "extract-started") {
    return {
      ...state,
      extractState: { isLoading: true, error: null, data: null },
      alternatives: createEmptyAlternativesState(),
    };
  }

  if (action.type === "extract-succeeded") {
    return {
      ...state,
      extractState: { isLoading: false, error: null, data: action.data },
    };
  }

  if (action.type === "extract-failed") {
    return {
      ...state,
      extractState: { isLoading: false, error: action.error, data: null },
    };
  }

  if (action.type === "alternatives-toggled") {
    const openIds = new Set(state.alternatives.openIds);
    if (action.nextOpen) {
      openIds.add(action.fontId);
    } else {
      openIds.delete(action.fontId);
    }
    return {
      ...state,
      alternatives: { ...state.alternatives, openIds },
    };
  }

  if (action.type === "alternatives-loading-started") {
    const loadingIds = new Set(state.alternatives.loadingIds);
    loadingIds.add(action.fontId);
    return {
      ...state,
      alternatives: { ...state.alternatives, loadingIds },
    };
  }

  if (action.type === "alternatives-loaded") {
    return {
      ...state,
      alternatives: {
        ...state.alternatives,
        byFontId: {
          ...state.alternatives.byFontId,
          [action.fontId]: action.alternatives,
        },
      },
    };
  }

  if (action.type === "alternatives-loading-finished") {
    const loadingIds = new Set(state.alternatives.loadingIds);
    loadingIds.delete(action.fontId);
    return {
      ...state,
      alternatives: { ...state.alternatives, loadingIds },
    };
  }

  if (action.type === "pending-paid-set") {
    return { ...state, pendingPaidDownload: action.font };
  }

  if (action.type === "results-cleared") {
    return {
      ...state,
      targetUrl: "",
      extractState: emptyExtractState,
      alternatives: createEmptyAlternativesState(),
    };
  }

  return state;
}

export function FontSnatcherPage() {
  const [state, dispatch] = useReducer(pageReducer, {
    targetUrl: "",
    extractState: emptyExtractState,
    alternatives: createEmptyAlternativesState(),
    pendingPaidDownload: null,
  });
  const extractRequestIdRef = useRef(0);
  const extractAbortControllerRef = useRef<AbortController | null>(null);

  const hasResults = state.extractState.data !== null;

  const fonts = useMemo<FontCardModel[]>(() => {
    if (!state.extractState.data) return [];
    return state.extractState.data.fonts.map((font, index) => toCardModel(font, index));
  }, [state.extractState.data]);

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

    dispatch({ type: "extract-started" });
    const clearControllerForCurrentRequest = () => {
      if (extractRequestIdRef.current === requestId) {
        extractAbortControllerRef.current = null;
      }
    };
    try {
      const data = await fetchExtractedFonts(state.targetUrl, controller.signal);
      if (extractRequestIdRef.current !== requestId) return;
      dispatch({ type: "extract-succeeded", data });
      clearControllerForCurrentRequest();
    } catch (error) {
      if (extractRequestIdRef.current !== requestId) return;
      if (isAbortError(error)) {
        clearControllerForCurrentRequest();
        return;
      }
      const message = error instanceof Error ? error.message : "Failed to extract fonts.";
      dispatch({ type: "extract-failed", error: message });
      clearControllerForCurrentRequest();
    }
  };

  const onToggleAlternatives = (font: FontCardModel, nextOpen: boolean) => {
    const hasCachedAlternatives = state.alternatives.byFontId[font.id] !== undefined;
    dispatch({ type: "alternatives-toggled", fontId: font.id, nextOpen });

    if (!nextOpen || hasCachedAlternatives) return;

    dispatch({ type: "alternatives-loading-started", fontId: font.id });
    const snapshotRequestId = extractRequestIdRef.current;

    fetchAlternatives(font)
      .then((alternatives) => {
        if (extractRequestIdRef.current !== snapshotRequestId) return;
        dispatch({ type: "alternatives-loaded", fontId: font.id, alternatives });
      })
      .catch(() => {
        if (extractRequestIdRef.current !== snapshotRequestId) return;
        dispatch({ type: "alternatives-loaded", fontId: font.id, alternatives: [] });
      })
      .finally(() => {
        if (extractRequestIdRef.current !== snapshotRequestId) return;
        dispatch({ type: "alternatives-loading-finished", fontId: font.id });
      });
  };

  const onRequestDownload = (font: FontCardModel) => {
    if (font.licenseStatus === "known_paid") {
      openExternalInNewTab(font.licenseUrl ?? font.downloadUrl);
      return;
    }
    if (font.licenseStatus === "unknown_or_paid") {
      dispatch({ type: "pending-paid-set", font });
      return;
    }
    openDownload(font.downloadUrl);
  };

  const confirmPaidDownload = () => {
    if (state.pendingPaidDownload) openDownload(state.pendingPaidDownload.downloadUrl);
    dispatch({ type: "pending-paid-set", font: null });
  };

  const clearResults = () => {
    dispatch({ type: "results-cleared" });
  };

  return (
    <LazyMotion features={domMax}>
      <m.main
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
        className="flex min-h-dvh flex-col bg-background text-foreground"
      >
        <section
          className="relative mx-auto flex w-full max-w-5xl flex-1 flex-col px-5 pb-24 sm:px-8 lg:px-12"
        >
          {/* Hero + search area with layout animation */}
          <m.div
            layout
            transition={gentleSpring}
            className={`flex flex-col items-center ${hasResults ? "gap-8 pt-12" : "gap-12 pt-[20vh]"}`}
          >
            {/* Header */}
            <m.header
              layout
              variants={heroStagger}
              initial="hidden"
              animate="visible"
              className="mx-auto max-w-2xl text-center"
            >
              <m.h1
                layout="position"
                variants={fadeUp}
                className="text-balance text-5xl leading-[0.95] font-light tracking-tight text-foreground sm:text-6xl lg:text-7xl"
              >
                <span className="font-display font-semibold italic">Snatch</span> any
                <br />
                font from the web
              </m.h1>

              <m.div
                initial={{ height: 0, opacity: 0, marginTop: 0 }}
                animate={
                  hasResults
                    ? { height: 0, opacity: 0, marginTop: 0 }
                    : { height: "auto", opacity: 1, marginTop: 32 }
                }
                transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
                style={{ overflow: "hidden" }}
              >
                <p className="mx-auto max-w-md text-pretty text-base leading-relaxed font-light text-muted-foreground">
                  Paste a URL. See every font. Preview, download, or find free alternatives.
                </p>
              </m.div>
            </m.header>

            <SearchForm
              targetUrl={state.targetUrl}
              onTargetUrlChange={(targetUrl) => dispatch({ type: "target-url-set", targetUrl })}
              isLoading={state.extractState.isLoading}
              hasResults={hasResults}
              onSubmit={onExtract}
            />
          </m.div>

          {/* Error */}
          <AnimatePresence>
            {state.extractState.error ? (
              <m.div
                key="error"
                initial={{ opacity: 0, y: 12, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.97 }}
                transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
                role="alert"
                aria-live="assertive"
                className="mx-auto mt-8 flex w-full max-w-xl items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-light text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-400"
              >
                <Warning weight="fill" className="h-5 w-5 shrink-0" />
                {state.extractState.error}
              </m.div>
            ) : null}
          </AnimatePresence>

          {/* Results */}
          {state.extractState.data && (
            <ResultsSection
              data={state.extractState.data}
              fonts={fonts}
              alternativesByFontId={state.alternatives.byFontId}
              alternativesOpenIds={state.alternatives.openIds}
              alternativesLoadingIds={state.alternatives.loadingIds}
              onToggleAlternatives={onToggleAlternatives}
              onRequestDownload={onRequestDownload}
              onClear={clearResults}
            />
          )}
        </section>

        {/* License dialog */}
        <AlertDialog
          open={state.pendingPaidDownload !== null}
          onOpenChange={(open) => {
            if (!open) dispatch({ type: "pending-paid-set", font: null });
          }}
        >
          <AlertDialogContent size="sm">
            <AlertDialogHeader>
              <AlertDialogTitle>License Warning</AlertDialogTitle>
              <AlertDialogDescription>
                {state.pendingPaidDownload?.licenseNote ??
                  "This font may be paid or restricted. Download and usage are at your own risk."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={confirmPaidDownload}>Download Anyway</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Footer */}
        <m.footer
          variants={footerVariants}
          initial="hidden"
          animate="visible"
          className="mt-auto border-t border-border/30 px-5 py-6 sm:px-8 lg:px-12"
        >
          <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 sm:flex-row sm:justify-between">
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] font-light text-muted-foreground/50">
              <span className="font-display italic text-foreground/40">Font Snatcher</span>
              <m.a
                href="https://ajanraj.com?utm_source=font-snatcher&utm_medium=footer&utm_campaign=projects"
                target="_blank"
                rel="noreferrer"
                whileHover={{ opacity: 1 }}
                className="underline-offset-3 transition-colors duration-150 hover:text-foreground hover:underline"
              >
                Ajan Raj
              </m.a>
              <m.a
                href="https://github.com/ajanraj/font-snatcher"
                target="_blank"
                rel="noreferrer"
                whileHover={{ opacity: 1 }}
                className="underline-offset-3 transition-colors duration-150 hover:text-foreground hover:underline"
              >
                GitHub
              </m.a>
              <m.a
                href="https://oschat.ai?utm_source=font-snatcher&utm_medium=footer&utm_campaign=projects"
                target="_blank"
                rel="noreferrer"
                whileHover={{ opacity: 1 }}
                className="flex items-center gap-1 underline-offset-3 transition-colors duration-150 hover:text-foreground hover:underline"
              >
                OS Chat
                <ArrowSquareOut weight="bold" className="h-2.5 w-2.5" />
              </m.a>
            </div>
            <div className="flex items-center gap-4">
              <Link
                to="/terms"
                className="flex items-center gap-2 rounded-full border border-amber-300/50 bg-amber-50/60 px-3 py-1.5 text-[11px] font-medium text-amber-700 transition-all duration-200 hover:border-amber-400/60 hover:bg-amber-100/70 dark:border-amber-700/40 dark:bg-amber-950/40 dark:text-amber-400 dark:hover:border-amber-600/50 dark:hover:bg-amber-900/40"
              >
                <Warning weight="fill" className="h-3.5 w-3.5 shrink-0" />
                Verify font licenses before use
              </Link>
              <ThemeToggle />
            </div>
          </div>
        </m.footer>
      </m.main>
    </LazyMotion>
  );
}
