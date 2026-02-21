import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Cursor, MagnifyingGlass, SpinnerGap } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  fadeUp,
  pillContainer,
  pillItem,
  spring,
} from "@/features/font-snatcher/motion-variants";

const EXAMPLE_URLS = [
  "stripe.com",
  "linear.app",
  "vercel.com",
  "ampcode.com",
  "figma.com",
  "github.com",
  "spotify.com",
  "airbnb.com",
  "claude.ai",
  "openai.com",
  "every.to",
  "raycast.com",
  "arc.net",
  "framer.com",
  "supabase.com",
];

const EXAMPLES_PER_SET = 5;

interface SearchFormProps {
  targetUrl: string;
  onTargetUrlChange: (url: string) => void;
  isLoading: boolean;
  hasResults: boolean;
  onSubmit: (event: FormEvent) => void;
}

export function SearchForm({
  targetUrl,
  onTargetUrlChange,
  isLoading,
  hasResults,
  onSubmit,
}: SearchFormProps) {
  const [exampleSet, setExampleSet] = useState(0);
  const examplesHoveredRef = useRef(false);

  const totalSets = Math.ceil(EXAMPLE_URLS.length / EXAMPLES_PER_SET);

  useEffect(() => {
    if (hasResults) return;
    const interval = setInterval(() => {
      if (!examplesHoveredRef.current) {
        setExampleSet((prev) => (prev + 1) % totalSets);
      }
    }, 3500);
    return () => clearInterval(interval);
  }, [hasResults, totalSets]);

  const visibleExamples = EXAMPLE_URLS.slice(
    exampleSet * EXAMPLES_PER_SET,
    exampleSet * EXAMPLES_PER_SET + EXAMPLES_PER_SET,
  );

  return (
    <>
      <motion.form
        layout="position"
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        onSubmit={onSubmit}
        className="mx-auto w-full max-w-xl"
      >
        <motion.div
          whileHover={{ scale: 1.01 }}
          transition={spring}
          className="relative rounded-2xl border border-border bg-card p-2 transition-all duration-300 focus-within:border-primary/25 focus-within:shadow-[0_0_20px_oklch(0.45_0.2_265_/_0.1)]"
        >
          <Input
            value={targetUrl}
            onChange={(event) => onTargetUrlChange(event.currentTarget.value)}
            placeholder="Enter any website URL..."
            aria-label="Website URL"
            className="h-13 rounded-xl border-0 bg-transparent px-5 pr-32 text-base font-light shadow-none placeholder:text-muted-foreground/50 focus-visible:ring-0 sm:pr-36"
            required
          />
          <motion.div className="absolute right-3.5 top-3.5">
            <Button
              type="submit"
              className="h-10 gap-2 rounded-xl bg-primary px-5 text-sm text-primary-foreground transition-colors duration-150 hover:bg-primary/85 sm:px-6"
              disabled={isLoading}
              aria-label="Extract fonts from website"
            >
              <AnimatePresence mode="wait" initial={false}>
                {isLoading ? (
                  <motion.span
                    key="loading"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.15 }}
                    className="flex items-center gap-2"
                  >
                    <SpinnerGap className="h-4 w-4 animate-spin" />
                    <span className="hidden sm:inline">Extracting</span>
                  </motion.span>
                ) : (
                  <motion.span
                    key="idle"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.15 }}
                    className="flex items-center gap-2"
                  >
                    <MagnifyingGlass weight="bold" className="h-4 w-4" />
                    <span className="hidden sm:inline">Extract</span>
                  </motion.span>
                )}
              </AnimatePresence>
            </Button>
          </motion.div>
        </motion.div>
      </motion.form>

      <AnimatePresence>
        {!hasResults && (
          <motion.div
            key="examples"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.2 } }}
            transition={{ duration: 0.4, delay: 0.3 }}
          >
            <div className="flex items-center justify-center gap-1.5 text-[11px] font-light text-muted-foreground/50">
              <Cursor weight="duotone" className="h-3 w-3" />
              <span>Try a site</span>
            </div>
            <div
              className="mt-3 flex min-h-7 items-center justify-center"
              onMouseEnter={() => { examplesHoveredRef.current = true; }}
              onMouseLeave={() => { examplesHoveredRef.current = false; }}
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={`set-${exampleSet}`}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  variants={pillContainer}
                  className="flex max-w-sm flex-wrap items-center justify-center gap-1.5 sm:max-w-none"
                >
                  {visibleExamples.map((example) => (
                    <motion.button
                      key={example}
                      type="button"
                      variants={pillItem}
                      whileHover={{ scale: 1.06, y: -1 }}
                      whileTap={{ scale: 0.95 }}
                      transition={spring}
                      className="rounded-full border border-border/60 bg-card px-3 py-1 font-mono text-[11px] font-light text-muted-foreground transition-colors duration-150 hover:border-primary/30 hover:text-foreground"
                      onClick={() => onTargetUrlChange(example)}
                    >
                      {example}
                    </motion.button>
                  ))}
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
