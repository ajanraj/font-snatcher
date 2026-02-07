import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FontPreview } from "@/features/font-snatcher/font-preview";
import type { MatchAlternative } from "@/features/font-snatcher/types";
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
  licenseStatus: "free_open" | "unknown_or_paid";
  licenseNote: string;
}

interface FontCardProps {
  font: FontCardModel;
  alternatives: MatchAlternative[];
  alternativesOpen: boolean;
  alternativesLoading: boolean;
  onToggleAlternatives: (font: FontCardModel, nextOpen: boolean) => void;
  onRequestDownload: (font: FontCardModel) => void;
}

export function FontCard({
  font,
  alternatives,
  alternativesOpen,
  alternativesLoading,
  onToggleAlternatives,
  onRequestDownload,
}: FontCardProps) {
  const alternativesRegionId = `${font.id}-alternatives`;

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-xl font-semibold text-slate-950 text-balance">{font.family}</h3>
          <a
            className="text-xs text-slate-500 hover:text-slate-700 underline-offset-2 hover:underline"
            href={font.url}
            target="_blank"
            rel="noreferrer"
          >
            {font.name}
          </a>
        </div>
        <span className="rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-[11px] uppercase tracking-wide text-blue-700">
          {font.format}
        </span>
      </div>

      <FontPreview font={font} text={FONT_PREVIEW_TEXT} />

      <div className="mt-4 flex items-center gap-3 text-xs text-slate-500 tabular-nums">
        <span>Weight {font.weight}</span>
        <span>{font.style}</span>
      </div>

      <div className="mt-4 grid gap-2">
        <Button
          className="h-10 rounded-lg bg-slate-950 text-white hover:bg-slate-800"
          onClick={() => onRequestDownload(font)}
          aria-label={`Download ${font.family}`}
        >
          Download
        </Button>

        <Button
          variant="outline"
          className="h-10 rounded-lg"
          onClick={() => onToggleAlternatives(font, !alternativesOpen)}
          aria-label={`${alternativesOpen ? "Hide" : "Find"} legal alternatives for ${font.family}`}
          aria-expanded={alternativesOpen}
          aria-controls={alternativesRegionId}
        >
          {alternativesOpen ? "Hide Legal Alternatives" : "Find Legal Alternatives"}
        </Button>
      </div>

      {alternativesOpen ? (
        <div
          id={alternativesRegionId}
          role="region"
          aria-label={`Legal alternatives for ${font.family}`}
          className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/70 p-3"
        >
          <p className="mb-2 text-xs font-medium uppercase text-emerald-700">
            Free & legal alternatives
          </p>
          {alternativesLoading ? (
            <p className="text-xs text-emerald-700">Finding alternatives...</p>
          ) : null}
          {!alternativesLoading && alternatives.length === 0 ? (
            <p className="text-xs text-emerald-700">No alternatives found yet.</p>
          ) : null}
          <ul className="grid gap-2">
            {alternatives.map((alternative) => (
              <li key={`${font.id}-${alternative.family}`}>
                <a
                  href={alternative.downloadUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between rounded-md border border-emerald-200 bg-white px-3 py-2 text-sm text-slate-800 hover:border-emerald-300"
                >
                  <div>
                    <p className="font-medium text-slate-900">{alternative.family}</p>
                    <p className="text-xs text-slate-500">{alternative.reason}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-emerald-700 tabular-nums">
                      {alternative.similarity}% match
                    </span>
                    <ExternalLink className="h-3.5 w-3.5 text-slate-400" aria-hidden />
                  </div>
                </a>
              </li>
            ))}
          </ul>
          {!alternativesLoading && alternatives.length > 0 ? (
            <p className="mt-3 text-xs italic text-slate-500">
              These Google Fonts are free to use commercially and personally.
            </p>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
