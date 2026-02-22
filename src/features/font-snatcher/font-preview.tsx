import { useEffect, useReducer } from "react";
import { AnimatePresence, LazyMotion, domMax, m } from "motion/react";
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

type PreviewState =
  | { status: "idle" | "loading" | "failed" }
  | { status: "loaded"; previewFamily: string };

type PreviewAction =
  | { type: "loading" }
  | { type: "loaded"; previewFamily: string }
  | { type: "failed" };

const previewBufferCache = new Map<string, Promise<ArrayBuffer>>();
const previewFamilyCache = new Map<string, string>();

function previewReducer(_state: PreviewState, action: PreviewAction): PreviewState {
  if (action.type === "loading") return { status: "loading" };
  if (action.type === "loaded") {
    return { status: "loaded", previewFamily: action.previewFamily };
  }
  return { status: "failed" };
}

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
  const [previewState, dispatch] = useReducer(previewReducer, { status: "idle" });

  useEffect(() => {
    let cancelled = false;

    const loadPreviewFont = async () => {
      dispatch({ type: "loading" });

      try {
        const familyName = await ensurePreviewFont(font);
        if (!cancelled) {
          dispatch({ type: "loaded", previewFamily: familyName });
        }
      } catch {
        if (!cancelled) {
          dispatch({ type: "failed" });
        }
      }
    };

    loadPreviewFont().catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [font]);

  const previewStyle =
    previewState.status === "loaded"
      ? { fontFamily: `"${previewState.previewFamily}", serif` }
      : { fontFamily: "var(--font-body)" };

  return (
    <LazyMotion features={domMax}>
      <div className="relative overflow-hidden rounded-xl border border-border/40 bg-muted/30 p-5">
        <m.p
          animate={{ opacity: previewState.status === "loaded" ? 1 : 0.3 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="text-2xl leading-[1.4] text-balance text-foreground"
          style={previewStyle}
        >
          {text}
        </m.p>

        <AnimatePresence>
          {previewState.status === "loading" && (
            <m.div
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
            </m.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {previewState.status === "failed" && (
            <m.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="mt-2 flex items-center gap-1.5 text-[11px] font-light text-amber-600 dark:text-amber-400"
            >
              <WarningCircle weight="fill" className="h-3.5 w-3.5" />
              Preview unavailable
            </m.div>
          )}
        </AnimatePresence>
      </div>
    </LazyMotion>
  );
}
