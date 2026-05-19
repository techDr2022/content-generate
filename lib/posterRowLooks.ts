import type { PosterLookId } from "@/lib/types";

export interface RowPosterLook {
  posterLook: PosterLookId;
  posterLookCustom: string;
}

export function defaultRowPosterLook(
  posterLook: PosterLookId = "text_only",
  posterLookCustom = ""
): RowPosterLook {
  return { posterLook, posterLookCustom };
}

export function buildInitialRowLooks(
  rowCount: number,
  defaultLook: PosterLookId = "text_only",
  defaultCustom = ""
): Record<number, RowPosterLook> {
  const base = defaultRowPosterLook(defaultLook, defaultCustom);
  const out: Record<number, RowPosterLook> = {};
  for (let i = 0; i < rowCount; i++) {
    out[i] = { ...base };
  }
  return out;
}

export function isRowPosterLookBlocked(look: RowPosterLook): boolean {
  return look.posterLook === "custom" && look.posterLookCustom.trim().length === 0;
}

export function applyDefaultLookToAllRows(
  rowCount: number,
  defaultLook: PosterLookId,
  defaultCustom: string
): Record<number, RowPosterLook> {
  return buildInitialRowLooks(rowCount, defaultLook, defaultCustom);
}
