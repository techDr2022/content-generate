import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { RunSpecialDay } from "@/components/generator/SpecialDaysInput";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function formatSavedAt(ms: number): string {
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(ms));
  } catch {
    return new Date(ms).toISOString();
  }
}

interface SuggestedSpecialDaysPanelProps {
  specialties: string[];
  month: number;
  year: number;
  disabled: boolean;
  loading: boolean;
  error: string | null;
  listSource: null | "cache" | "api";
  cacheSavedAt: number | null;
  rows: RunSpecialDay[];
  selected: boolean[];
  onToggle: (index: number, checked: boolean) => void;
  onSuggest: () => void;
  onRefreshFromAi: () => void;
}

export function SuggestedSpecialDaysPanel({
  specialties,
  month,
  year,
  disabled,
  loading,
  error,
  listSource,
  cacheSavedAt,
  rows,
  selected,
  onToggle,
  onSuggest,
  onRefreshFromAi,
}: SuggestedSpecialDaysPanelProps) {
  const monthLabel = `${MONTH_NAMES[month - 1] ?? month} ${year}`;

  return (
    <div className="relative space-y-3 overflow-hidden rounded-xl border border-emerald-200/80 bg-emerald-50/90 p-4 shadow-sm dark:border-emerald-900/55 dark:bg-emerald-950/30">
      <div
        className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-emerald-500/55 dark:bg-emerald-400/45"
        aria-hidden
      />
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Label className="text-base font-semibold text-emerald-950 dark:text-emerald-100">
            AI suggested special days
          </Label>
          <p className="mt-1 text-xs text-muted-foreground">
            Suggestions match this client’s specialties ({specialties.length ? specialties.join(", ") : "—"}) plus suitable broad health observances.
            Generated for <span className="font-medium text-foreground">{monthLabel}</span> (first selected month). Uncheck any day you don’t want in this calendar run. Lists for the{" "}
            <strong>same specialties + month</strong> are reused from this browser for about 90 days so Claude is not called every time.
          </p>
          {listSource === "cache" && rows.length > 0 ? (
            <p className="mt-2 text-xs font-medium text-emerald-900 dark:text-emerald-100/95">
              Loaded from saved suggestions in this browser
              {cacheSavedAt != null ? ` · ${formatSavedAt(cacheSavedAt)}` : ""}. Use <strong>Refresh from AI</strong> to fetch a new list (uses the API).
            </p>
          ) : null}
          {listSource === "api" && rows.length > 0 ? (
            <p className="mt-2 text-xs text-emerald-900/85 dark:text-emerald-100/85">
              Latest list came from Claude and was saved here for this specialty mix and month.
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={disabled || loading || rows.length === 0}
            onClick={() => {
              for (let i = 0; i < rows.length; i++) onToggle(i, true);
            }}
          >
            Select all
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={disabled || loading || rows.length === 0}
            onClick={() => {
              for (let i = 0; i < rows.length; i++) onToggle(i, false);
            }}
          >
            Deselect all
          </Button>
          <Button type="button" size="sm" disabled={disabled || loading} onClick={onSuggest}>
            {loading ? "Generating…" : "Suggest days"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={disabled || loading}
            onClick={onRefreshFromAi}
          >
            {loading ? "…" : "Refresh from AI"}
          </Button>
        </div>
      </div>

      {error ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
      ) : null}

      {rows.length === 0 && !loading ? (
        <p className="text-sm text-muted-foreground">
          {disabled ? (
            <>Choose a client with at least one specialty to load or generate suggestions.</>
          ) : (
            <>
              Click <strong>Suggest days</strong> to load this month (from your browser cache when available, otherwise Claude). Use{" "}
              <strong>Refresh from AI</strong> when you already have a list and want a brand-new suggestion set.
            </>
          )}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-muted-foreground">Asking Claude for specialty-aware dates…</p>
      ) : null}

      {rows.length > 0 ? (
        <ul className="max-h-[280px] space-y-2 overflow-y-auto rounded-lg border border-emerald-200/70 bg-card p-3 shadow-inner dark:border-emerald-900/50 dark:bg-background/80">
          {rows.map((row, idx) => (
            <li key={`${row.date}-${row.label}-${idx}`}>
              <label className="flex cursor-pointer items-start gap-3 text-sm leading-snug">
                <Checkbox
                  className="mt-0.5"
                  checked={selected[idx] ?? false}
                  onCheckedChange={(c) => onToggle(idx, c === true)}
                />
                <span>
                  <span className="font-medium">{row.label}</span>
                  <span className="text-muted-foreground"> · </span>
                  <span className="tabular-nums">{row.date}</span>
                  <span className="text-muted-foreground"> · </span>
                  <span className="capitalize">{row.type}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      ) : null}

      {rows.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          Selected suggested days are merged with manual rows below (same date: manual wins). Then click Generate.
        </p>
      ) : null}
    </div>
  );
}
