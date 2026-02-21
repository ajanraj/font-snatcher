import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CircleNotch, WarningCircle } from "@phosphor-icons/react";
import type { FontStyle } from "@/features/font-snatcher/types";

interface PreviewableFont {
  id: string;
  previewUrl: string;
  style: FontStyle;
  weight: string;
}

interface FontPreviewProps {
  font: PreviewableFont;
  text: string;
}

const previewBufferCache = new Map<string, Promise<ArrayBuffer>>();
const previewFamilyCache = new Map<string, string>();

function hashString(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return Math.abs(hash).toString(36);
}

function previewCacheKey(font: PreviewableFont): string {
  return `${font.previewUrl}::${font.style}::${font.weight}`;
}

async function fetchPreviewBuffer(previewUrl: string): Promise<ArrayBuffer> {
  const cached = previewBufferCache.get(previewUrl);
  if (cached) {
    return cached;
  }

  const pending = (async () => {
    const response = await fetch(previewUrl);
    if (!response.ok) {
      throw new Error(`Preview fetch failed (${response.status}).`);
    }

    return response.arrayBuffer();
  })();

  previewBufferCache.set(previewUrl, pending);
  try {
    return await pending;
  } catch (error) {
    previewBufferCache.delete(previewUrl);
    throw error;
  }
}

async function ensurePreviewFont(font: PreviewableFont): Promise<string> {
  const key = previewCacheKey(font);
  const cachedFamily = previewFamilyCache.get(key);
  if (cachedFamily) {
    return cachedFamily;
  }

  const buffer = await fetchPreviewBuffer(font.previewUrl);
  const familyName = `font-preview-${hashString(key)}`;
  const face = new FontFace(familyName, buffer, {
    style: font.style,
    weight: font.weight,
  });

  const loadedFace = await face.load();
  document.fonts.add(loadedFace);
  previewFamilyCache.set(key, familyName);
  return familyName;
}

export function FontPreview({ font, text }: FontPreviewProps) {
  const [status, setStatus] = useState<"idle" | "loading" | "loaded" | "failed">("idle");
  const [previewFamily, setPreviewFamily] = useState<string>("");

  useEffect(() => {
    let cancelled = false;

    const loadPreviewFont = async () => {
      setStatus("loading");

      try {
        const familyName = await ensurePreviewFont(font);
        if (!cancelled) {
          setPreviewFamily(familyName);
          setStatus("loaded");
        }
      } catch {
        if (!cancelled) {
          setStatus("failed");
        }
      }
    };

    loadPreviewFont().catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [font]);

  const previewStyle =
    status === "loaded"
      ? { fontFamily: `"${previewFamily}", serif` }
      : { fontFamily: "var(--font-body)" };

  return (
    <div className="relative overflow-hidden rounded-xl border border-border/40 bg-muted/30 p-5">
      <motion.p
        animate={{ opacity: status === "loaded" ? 1 : 0.3 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="text-2xl leading-[1.4] text-balance text-foreground"
        style={previewStyle}
      >
        {text}
      </motion.p>

      <AnimatePresence>
        {status === "loading" && (
          <motion.div
            key="loading-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 flex items-center justify-center bg-muted/50"
          >
            <div className="flex items-center gap-2 text-[11px] font-light text-muted-foreground">
              <CircleNotch weight="bold" className="h-3.5 w-3.5 animate-spin" />
              Loading preview
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {status === "failed" && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="mt-2 flex items-center gap-1.5 text-[11px] font-light text-amber-600 dark:text-amber-400"
          >
            <WarningCircle weight="fill" className="h-3.5 w-3.5" />
            Preview unavailable
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
