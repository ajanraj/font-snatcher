import {
  ArrowSquareOut,
  CaretDown,
  CaretUp,
  CircleNotch,
  DownloadSimple,
  Scales,
  TextAa,
} from "@phosphor-icons/react";
import { AnimatePresence, LazyMotion, domMax, m } from "motion/react";
import type { Variants } from "motion/react";
import { Button } from "@/components/ui/button";
import { FontPreview } from "@/features/font-snatcher/font-preview";
import type { FontLicenseStatus, MatchAlternative } from "@/features/font-snatcher/types";
import { FONT_PREVIEW_TEXT } from "@/server/font-extractor/constants";

export interface FontCardModel {
  id: string;
  name: string;
  family: string;
  format: string;
  url: string;
  weight: string;
  style: "normal" | "italic" | "oblique";
  referer: string;
  previewUrl: string;
  downloadUrl: string;
  licenseStatus: FontLicenseStatus;
  licenseNote: string;
  licenseUrl?: string;
}

interface FontCardProps {
  font: FontCardModel;
  alternatives: MatchAlternative[];
  alternativesOpen: boolean;
  alternativesLoading: boolean;
  onToggleAlternatives: (font: FontCardModel, nextOpen: boolean) => void;
  onRequestDownload: (font: FontCardModel) => void;
}

const spring = { type: "spring" as const, stiffness: 400, damping: 30 };

const altList: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05, delayChildren: 0.05 },
  },
};

const altItem: Variants = {
  hidden: { opacity: 0, x: -8 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.3, ease: [0.23, 1, 0.32, 1] },
  },
};

export function FontCard({
  font,
  alternatives,
  alternativesOpen,
  alternativesLoading,
  onToggleAlternatives,
  onRequestDownload,
}: FontCardProps) {
  const alternativesRegionId = `${font.id}-alternatives`;
  const isKnownPaid = font.licenseStatus === "known_paid";
  const actionLabel = isKnownPaid ? "Get License" : "Download";
  const actionAria = isKnownPaid ? `Get license for ${font.family}` : `Download ${font.family}`;

  return (
    <LazyMotion features={domMax}>
      <m.article
        whileHover={{ y: -3 }}
        transition={spring}
        className="group relative min-w-0 overflow-hidden rounded-2xl border border-border bg-card transition-shadow duration-200 hover:shadow-lg"
      >
        <div className="p-5">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <TextAa weight="duotone" className="h-4 w-4 shrink-0 text-primary/40" />
                <h3 className="truncate font-display text-lg text-foreground">{font.family}</h3>
              </div>
              <a
                className="mt-1.5 block truncate font-mono text-[10px] font-light text-muted-foreground/60 underline-offset-3 transition-colors duration-150 hover:text-primary hover:underline"
                href={font.url}
                target="_blank"
                rel="noreferrer"
              >
                {font.name}
              </a>
            </div>
            <span className="max-w-[7rem] shrink-0 truncate rounded-full bg-primary/8 px-2.5 py-1 font-mono text-[10px] font-light uppercase tracking-wider text-primary">
              {font.format}
            </span>
          </div>

          <FontPreview font={font} text={FONT_PREVIEW_TEXT} />

          <div className="mt-4 flex items-center gap-4 text-[11px] font-light text-muted-foreground/60">
            <span className="flex items-center gap-1.5 tabular-nums">
              <Scales weight="duotone" className="h-3.5 w-3.5 text-primary/30" />
              {font.weight}
            </span>
            <span className="capitalize">{font.style}</span>
          </div>

          <div className="mt-5 grid gap-2">
            <m.div whileTap={{ scale: 0.97 }} transition={spring}>
              <Button
                className="h-10 w-full gap-2 whitespace-normal rounded-xl bg-foreground text-center text-sm font-light text-background transition-colors duration-150 hover:bg-foreground/85"
                onClick={() => onRequestDownload(font)}
                aria-label={actionAria}
              >
                {isKnownPaid ? (
                  <ArrowSquareOut weight="bold" className="h-4 w-4" />
                ) : (
                  <DownloadSimple weight="bold" className="h-4 w-4" />
                )}
                {actionLabel}
              </Button>
            </m.div>

            <m.div whileTap={{ scale: 0.97 }} transition={spring}>
              <Button
                variant="outline"
                className="group/btn h-10 w-full gap-2 whitespace-normal rounded-xl text-center text-sm font-light transition-colors duration-150"
                onClick={() => onToggleAlternatives(font, !alternativesOpen)}
                aria-label={`${alternativesOpen ? "Hide" : "Find"} legal alternatives for ${font.family}`}
                aria-expanded={alternativesOpen}
                aria-controls={alternativesRegionId}
              >
                <AnimatePresence mode="wait" initial={false}>
                  {alternativesOpen ? (
                    <m.span
                      key="hide"
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.15 }}
                      className="flex items-center gap-2"
                    >
                      <CaretUp
                        weight="bold"
                        className="h-4 w-4 text-muted-foreground transition-colors duration-150 group-hover/btn:text-accent-foreground"
                      />
                      Hide Alternatives
                    </m.span>
                  ) : (
                    <m.span
                      key="find"
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.15 }}
                      className="flex items-center gap-2"
                    >
                      <CaretDown
                        weight="bold"
                        className="h-4 w-4 text-muted-foreground transition-colors duration-150 group-hover/btn:text-accent-foreground"
                      />
                      Find Alternatives
                    </m.span>
                  )}
                </AnimatePresence>
              </Button>
            </m.div>
          </div>
        </div>

        <AnimatePresence>
          {alternativesOpen && (
            <m.div
              id={alternativesRegionId}
              role="region"
              aria-label={`Legal alternatives for ${font.family}`}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
              className="border-t border-emerald-200/50 bg-emerald-50/40 dark:border-emerald-900/30 dark:bg-emerald-950/20"
            >
              <div className="p-4">
                <p className="mb-3 flex items-center gap-2 text-[10px] font-light uppercase tracking-[0.15em] text-emerald-700 dark:text-emerald-400">
                  <Scales weight="fill" className="h-3.5 w-3.5" />
                  Free alternatives
                </p>
                {alternativesLoading ? (
                  <div
                    className="flex items-center gap-2 text-xs font-light text-emerald-700 dark:text-emerald-400"
                  >
                    <CircleNotch weight="bold" className="h-3.5 w-3.5 animate-spin" />
                    Searching...
                  </div>
                ) : null}
                {!alternativesLoading && alternatives.length === 0 ? (
                  <p
                    className="text-xs font-light text-emerald-700/60 dark:text-emerald-400/60"
                  >
                    No alternatives found yet.
                  </p>
                ) : null}
                {alternatives.length > 0 ? (
                  <m.ul
                    variants={altList}
                    initial="hidden"
                    animate="visible"
                    className="grid gap-2"
                  >
                    {alternatives.map((alternative) => (
                      <m.li key={`${font.id}-${alternative.family}`} variants={altItem}>
                        <m.a
                          href={alternative.downloadUrl}
                          target="_blank"
                          rel="noreferrer"
                          whileHover={{ x: 3 }}
                          transition={spring}
                          className="flex min-w-0 items-center justify-between rounded-xl border border-emerald-200/40 bg-card px-3.5 py-2.5 text-sm font-light text-foreground/90 transition-colors duration-150 hover:border-emerald-300/60 hover:bg-emerald-50/30 dark:border-emerald-800/30 dark:hover:border-emerald-700/40 dark:hover:bg-emerald-950/15"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-normal text-foreground">
                              {alternative.family}
                            </p>
                            <p className="truncate text-xs font-light text-muted-foreground">
                              {alternative.reason}
                            </p>
                          </div>
                          <div className="ml-3 flex shrink-0 items-center gap-2">
                            <span className="font-mono text-xs text-emerald-700 tabular-nums dark:text-emerald-400">
                              {alternative.similarity}%
                            </span>
                            <ArrowSquareOut
                              weight="bold"
                              className="h-3.5 w-3.5 text-muted-foreground/40"
                            />
                          </div>
                        </m.a>
                      </m.li>
                    ))}
                  </m.ul>
                ) : null}
                {!alternativesLoading && alternatives.length > 0 ? (
                  <p className="mt-3 text-[10px] font-light text-muted-foreground/50">
                    Google Fonts — free for commercial and personal use.
                  </p>
                ) : null}
              </div>
            </m.div>
          )}
        </AnimatePresence>
      </m.article>
    </LazyMotion>
  );
}
