import type { RunSpecialDay } from "@/components/generator/SpecialDaysInput";

const STORAGE_PREFIX = "cg:suggestedSpecialDays:v1:";

/** Reuse suggestions without a new Claude call; "Refresh from AI" still updates this entry. */
export const SUGGESTED_SPECIAL_DAYS_CACHE_TTL_MS = 90 * 24 * 60 * 60 * 1000;

const DAY_TYPES = new Set<RunSpecialDay["type"]>(["festival", "awareness", "campaign"]);

export function fingerprintSpecialties(specialties: string[]): string {
  return specialties
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .sort()
    .join("\u0001");
}

function storageKey(fingerprint: string, month: number, year: number): string {
  const m = month < 10 ? `0${month}` : String(month);
  return `${STORAGE_PREFIX}${fingerprint}:${year}-${m}`;
}

function parseDays(raw: unknown): RunSpecialDay[] | null {
  if (!Array.isArray(raw)) return null;
  const out: RunSpecialDay[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    const label = typeof o.label === "string" ? o.label.trim() : "";
    const date = typeof o.date === "string" ? o.date.trim() : "";
    const type = o.type;
    if (!label || !/^\d{4}-\d{2}-\d{2}$/.test(date) || typeof type !== "string" || !DAY_TYPES.has(type as RunSpecialDay["type"])) {
      continue;
    }
    out.push({ label, date, type: type as RunSpecialDay["type"] });
  }
  return out.length > 0 ? out : null;
}

export function readCachedSuggestedSpecialDays(
  specialties: string[],
  month: number,
  year: number
): { days: RunSpecialDay[]; savedAt: number } | null {
  if (typeof window === "undefined") return null;
  try {
    const fp = fingerprintSpecialties(specialties);
    if (!fp) return null;
    const raw = localStorage.getItem(storageKey(fp, month, year));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { savedAt?: number; days?: unknown };
    if (typeof parsed.savedAt !== "number" || !Array.isArray(parsed.days)) return null;
    if (Date.now() - parsed.savedAt > SUGGESTED_SPECIAL_DAYS_CACHE_TTL_MS) return null;
    const days = parseDays(parsed.days);
    if (!days) return null;
    return { days, savedAt: parsed.savedAt };
  } catch {
    return null;
  }
}

export function writeCachedSuggestedSpecialDays(
  specialties: string[],
  month: number,
  year: number,
  days: RunSpecialDay[]
): void {
  if (typeof window === "undefined") return;
  try {
    const fp = fingerprintSpecialties(specialties);
    if (!fp || days.length === 0) return;
    localStorage.setItem(storageKey(fp, month, year), JSON.stringify({ savedAt: Date.now(), days }));
  } catch {
    // Quota, private mode, or disabled storage
  }
}
