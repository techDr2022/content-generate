import { useEffect, useMemo, useRef, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ClientSpecialDaySuggestion } from "@/hooks/useClients";
import { useSuggestClientSpecialDays } from "@/hooks/useClients";
import {
  fingerprintSpecialties,
  readCachedSuggestedSpecialDays,
  writeCachedSuggestedSpecialDays,
} from "@/lib/client/suggestedSpecialDaysCache";
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

interface ClientSuggestedSpecialDaysPanelProps {
  specialties: string[];
  clinicName: string;
  city: string;
  disabled?: boolean;
  onAddDays: (days: ClientSpecialDaySuggestion[]) => void;
}

export function ClientSuggestedSpecialDaysPanel({
  specialties,
  clinicName,
  city,
  disabled = false,
  onAddDays,
}: ClientSuggestedSpecialDaysPanelProps) {
  const now = useMemo(() => new Date(), []);
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [rows, setRows] = useState<RunSpecialDay[]>([]);
  const [selected, setSelected] = useState<boolean[]>([]);
  const [listSource, setListSource] = useState<null | "cache" | "api">(null);
  const [cacheSavedAt, setCacheSavedAt] = useState<number | null>(null);
  const suggest = useSuggestClientSpecialDays();
  const rowsLenRef = useRef(0);
  rowsLenRef.current = rows.length;

  const specKey = fingerprintSpecialties(specialties);
  const monthLabel = `${MONTH_NAMES[month - 1] ?? month} ${year}`;
  const noSpecialties = specialties.length === 0;
  const panelDisabled = disabled || noSpecialties;

  useEffect(() => {
    if (noSpecialties) {
      setRows([]);
      setSelected([]);
      setListSource(null);
      setCacheSavedAt(null);
      return;
    }
    const cached = readCachedSuggestedSpecialDays(specialties, month, year);
    if (cached?.days.length) {
      setRows(cached.days);
      setSelected(cached.days.map(() => true));
      setListSource("cache");
      setCacheSavedAt(cached.savedAt);
    } else {
      setRows([]);
      setSelected([]);
      setListSource(null);
      setCacheSavedAt(null);
    }
  }, [specKey, month, year, noSpecialties, specialties]);

  useEffect(() => {
    if (rows.length === 0) {
      setSelected((prev) => (prev.length === 0 ? prev : []));
      return;
    }
    setSelected((prev) => {
      if (prev.length === rows.length) return prev;
      return rows.map((_, i) => (i < prev.length ? prev[i] === true : true));
    });
  }, [rows]);

  function handleToggle(index: number, checked: boolean): void {
    setSelected((prev) => {
      const next = [...prev];
      next[index] = checked;
      return next;
    });
  }

  function applyRows(data: RunSpecialDay[], source: "cache" | "api", savedAt: number | null): void {
    setRows(data);
    setSelected(data.map(() => true));
    setListSource(source);
    setCacheSavedAt(savedAt);
  }

  function handleSuggest(forceApi = false): void {
    if (panelDisabled) return;
    suggest.reset();

    if (!forceApi) {
      const cached = readCachedSuggestedSpecialDays(specialties, month, year);
      if (cached?.days.length) {
        if (rowsLenRef.current === 0) {
          applyRows(cached.days, "cache", cached.savedAt);
        }
        return;
      }
    }

    suggest.mutate(
      {
        specialties,
        month,
        year,
        clinicName: clinicName.trim() || undefined,
        city: city.trim() || undefined,
      },
      {
        onSuccess: (data) => {
          applyRows(data, "api", null);
          writeCachedSuggestedSpecialDays(specialties, month, year, data);
        },
      }
    );
  }

  function handleAddSelected(): void {
    const picked = rows.filter((_, i) => selected[i] === true);
    if (picked.length === 0) return;
    onAddDays(picked);
  }

  const error = suggest.isError
    ? suggest.error instanceof Error
      ? suggest.error.message
      : "Could not suggest special days"
    : null;
  const selectedCount = selected.filter(Boolean).length;

  return (
    <div className="relative space-y-3 overflow-hidden rounded-xl border border-emerald-200/80 bg-emerald-50/90 p-4 shadow-sm dark:border-emerald-900/55 dark:bg-emerald-950/30">
        <div
          className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-emerald-500/55 dark:bg-emerald-400/45"
          aria-hidden
        />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Label className="text-base font-semibold text-emerald-950 dark:text-emerald-100">
            AI suggested special days
          </Label>
          <p className="mt-1 text-xs text-muted-foreground">
            Based on selected specialties
            {specialties.length ? ` (${specialties.join(", ")})` : ""} for{" "}
            <span className="font-medium text-foreground">{monthLabel}</span>. Check the days you want, then add them to
            the client profile below. Same specialty mix + month is cached in this browser for about 90 days.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <Label htmlFor="client-suggest-month" className="text-xs">
              Month
            </Label>
            <select
              id="client-suggest-month"
              className="mt-1 flex h-9 w-[9.5rem] rounded-md border border-input bg-background px-2 text-sm"
              value={month}
              disabled={panelDisabled}
              onChange={(e) => setMonth(Number(e.target.value))}
            >
              {MONTH_NAMES.map((name, i) => (
                <option key={name} value={i + 1}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="client-suggest-year" className="text-xs">
              Year
            </Label>
            <Input
              id="client-suggest-year"
              type="number"
              className="mt-1 w-24"
              min={2020}
              max={2100}
              value={year}
              disabled={panelDisabled}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (Number.isFinite(n)) setYear(Math.min(2100, Math.max(2020, Math.floor(n))));
              }}
            />
          </div>
        </div>
      </div>

      {listSource === "cache" && rows.length > 0 ? (
        <p className="text-xs font-medium text-emerald-900 dark:text-emerald-100/95">
          Loaded from saved suggestions in this browser
          {cacheSavedAt != null ? ` · ${formatSavedAt(cacheSavedAt)}` : ""}. Use <strong>Refresh from AI</strong> for a
          new list.
        </p>
      ) : null}
      {listSource === "api" && rows.length > 0 ? (
        <p className="text-xs text-emerald-900/85 dark:text-emerald-100/85">
          Latest list came from Claude and was saved for this specialty mix and month.
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={panelDisabled || suggest.isPending || rows.length === 0}
          onClick={() => {
            for (let i = 0; i < rows.length; i++) handleToggle(i, true);
          }}
        >
          Select all
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={panelDisabled || suggest.isPending || rows.length === 0}
          onClick={() => {
            for (let i = 0; i < rows.length; i++) handleToggle(i, false);
          }}
        >
          Deselect all
        </Button>
        <Button type="button" size="sm" disabled={panelDisabled || suggest.isPending} onClick={() => handleSuggest(false)}>
          {suggest.isPending ? "Generating…" : "Suggest days"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={panelDisabled || suggest.isPending}
          onClick={() => handleSuggest(true)}
        >
          {suggest.isPending ? "…" : "Refresh from AI"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="default"
          disabled={panelDisabled || suggest.isPending || selectedCount === 0}
          onClick={handleAddSelected}
        >
          Add {selectedCount > 0 ? `${selectedCount} ` : ""}to client
        </Button>
      </div>

      {error ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
      ) : null}

      {rows.length === 0 && !suggest.isPending ? (
        <p className="text-sm text-muted-foreground">
          {noSpecialties ? (
            <>
              Select at least one specialty above, then click <strong>Suggest days</strong>.
            </>
          ) : (
            <>
              Click <strong>Suggest days</strong> for {monthLabel} (from browser cache when available, otherwise Claude).
            </>
          )}
        </p>
      ) : null}

      {suggest.isPending ? (
        <p className="text-sm text-muted-foreground">Asking Claude for specialty-aware dates…</p>
      ) : null}

      {rows.length > 0 ? (
        <ul className="max-h-[240px] space-y-2 overflow-y-auto rounded-lg border border-emerald-200/70 bg-card p-3 shadow-inner dark:border-emerald-900/50 dark:bg-background/80">
          {rows.map((row, idx) => (
            <li key={`${row.date}-${row.label}-${idx}`}>
              <label className="flex cursor-pointer items-start gap-3 text-sm leading-snug">
                <Checkbox
                  className="mt-0.5"
                  checked={selected[idx] ?? false}
                  onCheckedChange={(c) => handleToggle(idx, c === true)}
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
          Added days appear in the list below. Run generation for the same calendar month to use them automatically.
        </p>
      ) : null}
    </div>
  );
}
