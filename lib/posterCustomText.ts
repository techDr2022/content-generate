/** Split bulk custom poster copy on a line that contains only `---`. */
export function parseCustomPosterTexts(raw: string): string[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];
  return trimmed
    .split(/\n\s*---\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean);
}
