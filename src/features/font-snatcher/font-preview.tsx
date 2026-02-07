import { useEffect, useState } from "react";
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
    <div className="relative overflow-hidden rounded-xl border border-slate-100 bg-slate-50/50 p-4">
      <p
        className={`text-2xl leading-[1.4] text-balance text-slate-950 transition-opacity duration-300 ease-[cubic-bezier(0.165,0.84,0.44,1)] ${
          status === "loaded" ? "opacity-100" : "opacity-40"
        }`}
        style={previewStyle}
      >
        {text}
      </p>
      {status === "loading" ? (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-50/80">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <CircleNotch weight="bold" className="h-3.5 w-3.5 animate-spin" />
            Loading preview
          </div>
        </div>
      ) : null}
      {status === "failed" ? (
        <div className="mt-2 flex items-center gap-1.5 text-[11px] text-amber-700">
          <WarningCircle weight="fill" className="h-3.5 w-3.5" />
          Preview unavailable
        </div>
      ) : null}
    </div>
  );
}
