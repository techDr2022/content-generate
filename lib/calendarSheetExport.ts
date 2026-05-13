import type { CalendarPost } from "@/lib/types";

const HEADERS = [
  "Date",
  "Code",
  "Department",
  "Type",
  "Style",
  "Text in image",
  "Supporting text",
] as const;

/** Quote TSV fields when they contain tab, newline, or double-quote (Google Sheets–friendly paste). */
function escapeTsvField(raw: string): string {
  const s = raw ?? "";
  if (!/[\t\n\r"]/.test(s)) return s;
  return `"${s.replace(/"/g, '""')}"`;
}

/**
 * Tab-separated text + header row — paste into Google Sheets / Excel and columns align.
 */
export function calendarPostsToTsv(rows: CalendarPost[]): string {
  const headerLine = HEADERS.map((h) => escapeTsvField(h)).join("\t");
  const dataLines = rows.map((r) =>
    [
      r.date,
      r.code,
      r.department,
      r.type,
      r.style,
      r.textInImage,
      r.supportingText,
    ]
      .map((cell) => escapeTsvField(String(cell ?? "")))
      .join("\t")
  );
  return [headerLine, ...dataLines].join("\n");
}

export async function copyCalendarPostsForSheets(rows: CalendarPost[]): Promise<void> {
  const tsv = calendarPostsToTsv(rows);
  await navigator.clipboard.writeText(tsv);
}
