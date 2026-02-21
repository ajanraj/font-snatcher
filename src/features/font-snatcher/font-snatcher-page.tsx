import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { AnimatePresence, motion } from "motion/react";
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
import type { MatchAlternative } from "@/features/font-snatcher/types";

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

  const hasResults = extractState.data !== null;

  const fonts = useMemo<FontCardModel[]>(() => {
    if (!extractState.data) return [];
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

    setExtractState({ isLoading: true, error: null, data: null });
    setAlternativesOpenIds(new Set());
    setAlternativesByFontId({});
    setAlternativesLoadingIds(new Set());

    try {
      const data = await fetchExtractedFonts(targetUrl, controller.signal);
      if (extractRequestIdRef.current !== requestId) return;
      setExtractState({ isLoading: false, error: null, data });
    } catch (error) {
      if (isAbortError(error)) return;
      if (extractRequestIdRef.current !== requestId) return;
      const message = error instanceof Error ? error.message : "Failed to extract fonts.";
      setExtractState({ isLoading: false, error: message, data: null });
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

    if (!nextOpen || alternativesByFontId[font.id]) return;

    const nextLoading = new Set(alternativesLoadingIds);
    nextLoading.add(font.id);
    setAlternativesLoadingIds(nextLoading);
    const snapshotRequestId = extractRequestIdRef.current;

    fetchAlternatives(font)
      .then((alternatives) => {
        if (extractRequestIdRef.current !== snapshotRequestId) return;
        setAlternativesByFontId((prev) => ({ ...prev, [font.id]: alternatives }));
      })
      .catch(() => {
        if (extractRequestIdRef.current !== snapshotRequestId) return;
        setAlternativesByFontId((prev) => ({ ...prev, [font.id]: [] }));
      })
      .finally(() => {
        if (extractRequestIdRef.current !== snapshotRequestId) return;
        setAlternativesLoadingIds((prev) => {
          const updated = new Set(prev);
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
    if (pendingPaidDownload) openDownload(pendingPaidDownload.downloadUrl);
    setPendingPaidDownload(null);
  };

  const clearResults = () => {
    setExtractState({ isLoading: false, error: null, data: null });
    setTargetUrl("");
    setAlternativesOpenIds(new Set());
    setAlternativesByFontId({});
  };

  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="flex min-h-dvh flex-col bg-background text-foreground"
    >
      <section
        className="relative mx-auto flex w-full max-w-5xl flex-1 flex-col px-5 pb-24 sm:px-8 lg:px-12"
      >
        {/* Hero + search area with layout animation */}
        <motion.div
          layout
          transition={gentleSpring}
          className={`flex flex-col items-center ${hasResults ? "gap-8 pt-12" : "gap-12 pt-[20vh]"}`}
        >
          {/* Header */}
          <motion.header
            layout
            variants={heroStagger}
            initial="hidden"
            animate="visible"
            className="mx-auto max-w-2xl text-center"
          >
            <motion.h1
              layout="position"
              variants={fadeUp}
              className="text-balance text-5xl leading-[0.95] font-light tracking-tight text-foreground sm:text-6xl lg:text-7xl"
            >
              <span className="font-display font-semibold italic">Snatch</span> any
              <br />
              font from the web
            </motion.h1>

            <motion.div
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
            </motion.div>
          </motion.header>

          <SearchForm
            targetUrl={targetUrl}
            onTargetUrlChange={setTargetUrl}
            isLoading={extractState.isLoading}
            hasResults={hasResults}
            onSubmit={onExtract}
          />
        </motion.div>

        {/* Error */}
        <AnimatePresence>
          {extractState.error ? (
            <motion.div
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
              {extractState.error}
            </motion.div>
          ) : null}
        </AnimatePresence>

        {/* Results */}
        {extractState.data && (
          <ResultsSection
            data={extractState.data}
            fonts={fonts}
            alternativesByFontId={alternativesByFontId}
            alternativesOpenIds={alternativesOpenIds}
            alternativesLoadingIds={alternativesLoadingIds}
            onToggleAlternatives={onToggleAlternatives}
            onRequestDownload={onRequestDownload}
            onClear={clearResults}
          />
        )}
      </section>

      {/* License dialog */}
      <AlertDialog
        open={pendingPaidDownload !== null}
        onOpenChange={(open) => {
          if (!open) setPendingPaidDownload(null);
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

      {/* Footer */}
      <motion.footer
        variants={footerVariants}
        initial="hidden"
        animate="visible"
        className="mt-auto border-t border-border/30 px-5 py-6 sm:px-8 lg:px-12"
      >
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 sm:flex-row sm:justify-between">
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] font-light text-muted-foreground/50">
            <span className="font-display italic text-foreground/40">Font Snatcher</span>
            <motion.a
              href="https://ajanraj.com?utm_source=font-snatcher&utm_medium=footer&utm_campaign=projects"
              target="_blank"
              rel="noreferrer"
              whileHover={{ opacity: 1 }}
              className="underline-offset-3 transition-colors duration-150 hover:text-foreground hover:underline"
            >
              Ajan Raj
            </motion.a>
            <motion.a
              href="https://github.com/ajanraj/font-snatcher"
              target="_blank"
              rel="noreferrer"
              whileHover={{ opacity: 1 }}
              className="underline-offset-3 transition-colors duration-150 hover:text-foreground hover:underline"
            >
              GitHub
            </motion.a>
            <motion.a
              href="https://oschat.ai?utm_source=font-snatcher&utm_medium=footer&utm_campaign=projects"
              target="_blank"
              rel="noreferrer"
              whileHover={{ opacity: 1 }}
              className="flex items-center gap-1 underline-offset-3 transition-colors duration-150 hover:text-foreground hover:underline"
            >
              OS Chat
              <ArrowSquareOut weight="bold" className="h-2.5 w-2.5" />
            </motion.a>
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
      </motion.footer>
    </motion.main>
  );
}
