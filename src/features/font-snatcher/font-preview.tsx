import { useEffect, useState } from "react";
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
    <div className="rounded-xl border border-white/65 bg-white/80 p-4 shadow-sm">
      <p className="text-3xl leading-[1.35] text-balance text-slate-950" style={previewStyle}>
        {text}
      </p>
      {status === "loading" ? (
        <p className="mt-3 text-[11px] text-slate-500">Loading live preview...</p>
      ) : null}
      {status === "failed" ? (
        <p className="mt-3 text-[11px] text-amber-700">
          Preview unavailable. Download may still work.
        </p>
      ) : null}
    </div>
  );
}
