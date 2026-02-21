import { AnimatePresence, motion } from "motion/react";
import { X } from "@phosphor-icons/react";
import { FontCard, type FontCardModel } from "@/features/font-snatcher/font-card";
import { cardGrid, cardItem, spring } from "@/features/font-snatcher/motion-variants";
import type { ExtractApiResponse, MatchAlternative } from "@/features/font-snatcher/types";

interface ResultsSectionProps {
  data: ExtractApiResponse;
  fonts: FontCardModel[];
  alternativesByFontId: Record<string, MatchAlternative[]>;
  alternativesOpenIds: Set<string>;
  alternativesLoadingIds: Set<string>;
  onToggleAlternatives: (font: FontCardModel, nextOpen: boolean) => void;
  onRequestDownload: (font: FontCardModel) => void;
  onClear: () => void;
}

export function ResultsSection({
  data,
  fonts,
  alternativesByFontId,
  alternativesOpenIds,
  alternativesLoadingIds,
  onToggleAlternatives,
  onRequestDownload,
  onClear,
}: ResultsSectionProps) {
  return (
    <AnimatePresence mode="wait">
      <motion.section
        key="results"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
        className="mt-10 space-y-6"
      >
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="flex flex-wrap items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-primary/8 px-2.5 py-1 font-mono text-[11px] font-light tabular-nums text-primary">
              {data.totalFound} font
              {data.totalFound !== 1 ? "s" : ""}
            </span>
            <motion.button
              type="button"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.92 }}
              transition={spring}
              onClick={onClear}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-light text-muted-foreground transition-colors duration-100 hover:bg-accent hover:text-accent-foreground"
              aria-label="Clear results"
            >
              <X weight="bold" className="h-3 w-3" />
              Clear
            </motion.button>
          </div>
          <p className="truncate rounded-full border border-border/50 px-3 py-1 font-mono text-[10px] font-light text-muted-foreground/60">
            {data.sourceUrl}
          </p>
        </motion.div>

        <motion.div
          variants={cardGrid}
          initial="hidden"
          animate="visible"
          className="grid gap-5 md:grid-cols-2 xl:grid-cols-3"
        >
          {fonts.map((font) => (
            <motion.div key={font.id} variants={cardItem} className="min-w-0">
              <FontCard
                font={font}
                alternatives={alternativesByFontId[font.id] ?? []}
                alternativesOpen={alternativesOpenIds.has(font.id)}
                alternativesLoading={alternativesLoadingIds.has(font.id)}
                onToggleAlternatives={onToggleAlternatives}
                onRequestDownload={onRequestDownload}
              />
            </motion.div>
          ))}
        </motion.div>
      </motion.section>
    </AnimatePresence>
  );
}
