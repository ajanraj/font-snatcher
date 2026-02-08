import {
  ArrowSquareOut,
  CaretDown,
  CaretUp,
  CircleNotch,
  DownloadSimple,
  Scales,
  TextAa,
} from "@phosphor-icons/react";
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
    <article className="group relative rounded-2xl border border-border bg-card p-5 shadow-sm transition-shadow duration-150 ease-out hover:shadow-md">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <TextAa weight="duotone" className="h-4 w-4 shrink-0 text-muted-foreground/70" />
            <h3 className="truncate text-lg font-semibold text-foreground">{font.family}</h3>
          </div>
          <a
            className="mt-1 block truncate text-xs text-muted-foreground underline-offset-2 transition-colors duration-100 ease-out hover:text-foreground/80 hover:underline"
            href={font.url}
            target="_blank"
            rel="noreferrer"
          >
            {font.name}
          </a>
        </div>
        <span className="shrink-0 rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300">
          {font.format}
        </span>
      </div>

      <FontPreview font={font} text={FONT_PREVIEW_TEXT} />

      <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5 tabular-nums">
          <Scales weight="duotone" className="h-3.5 w-3.5" />
          {font.weight}
        </span>
        <span className="capitalize">{font.style}</span>
      </div>

      <div className="mt-4 grid gap-2">
        <Button
          className="h-10 gap-2 rounded-lg bg-foreground text-background transition-transform duration-75 ease-out active:scale-[0.97] hover:bg-foreground/90"
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

        <Button
          variant="outline"
          className="group/btn h-10 gap-2 rounded-lg transition-colors duration-100 ease-out"
          onClick={() => onToggleAlternatives(font, !alternativesOpen)}
          aria-label={`${alternativesOpen ? "Hide" : "Find"} legal alternatives for ${font.family}`}
          aria-expanded={alternativesOpen}
          aria-controls={alternativesRegionId}
        >
          {alternativesOpen ? (
            <>
              <CaretUp
                weight="bold"
                className="h-4 w-4 text-muted-foreground transition-colors duration-100 group-hover/btn:text-accent-foreground"
              />
              Hide Alternatives
            </>
          ) : (
            <>
              <CaretDown
                weight="bold"
                className="h-4 w-4 text-muted-foreground transition-colors duration-100 group-hover/btn:text-accent-foreground"
              />
              Find Alternatives
            </>
          )}
        </Button>
      </div>

      {alternativesOpen && (
        <div
          id={alternativesRegionId}
          role="region"
          aria-label={`Legal alternatives for ${font.family}`}
          className="animate-fade-in-up mt-4 rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 dark:border-emerald-800 dark:bg-emerald-950/50"
          style={{ willChange: "transform, opacity" }}
        >
          <p className="mb-2 flex items-center gap-2 text-xs font-medium uppercase text-emerald-700 dark:text-emerald-400">
            <Scales weight="fill" className="h-3.5 w-3.5" />
            Free & legal alternatives
          </p>
          {alternativesLoading ? (
            <div className="flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-400">
              <CircleNotch weight="bold" className="h-3.5 w-3.5 animate-spin" />
              Finding alternatives...
            </div>
          ) : null}
          {!alternativesLoading && alternatives.length === 0 ? (
            <p className="text-xs text-emerald-700 dark:text-emerald-400">
              No alternatives found yet.
            </p>
          ) : null}
          <ul className="grid gap-2">
            {alternatives.map((alternative, index) => (
              <li
                key={`${font.id}-${alternative.family}`}
                className="animate-fade-in-up"
                style={{ animationDelay: `${index * 30}ms`, willChange: "transform, opacity" }}
              >
                <a
                  href={alternative.downloadUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between rounded-md border border-emerald-200 bg-card px-3 py-2 text-sm text-foreground/90 transition-colors duration-100 ease-out hover:border-emerald-300 hover:bg-emerald-50/50 dark:border-emerald-800 dark:hover:border-emerald-700 dark:hover:bg-emerald-950/30"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-foreground">{alternative.family}</p>
                    <p className="truncate text-xs text-muted-foreground">{alternative.reason}</p>
                  </div>
                  <div className="ml-3 flex shrink-0 items-center gap-2">
                    <span className="text-xs font-semibold text-emerald-700 tabular-nums dark:text-emerald-400">
                      {alternative.similarity}%
                    </span>
                    <ArrowSquareOut
                      weight="bold"
                      className="h-3.5 w-3.5 text-muted-foreground/70"
                    />
                  </div>
                </a>
              </li>
            ))}
          </ul>
          {!alternativesLoading && alternatives.length > 0 ? (
            <p className="mt-3 text-xs italic text-muted-foreground">
              These Google Fonts are free to use commercially and personally.
            </p>
          ) : null}
        </div>
      )}
    </article>
  );
}
