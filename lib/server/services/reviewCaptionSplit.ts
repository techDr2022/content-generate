/** Pull hashtag tokens from supporting text for review UI; remainder is caption body. */
export function splitCaptionAndHashtags(supportingText: string): { caption: string; hashtags: string } {
  const raw = supportingText.trim();
  const tagMatches = raw.match(/#[A-Za-z0-9_]+/g) ?? [];
  const tags = tagMatches.map((t) => t.replace(/^#/, ""));
  const caption = raw
    .replace(/#[A-Za-z0-9_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return { caption, hashtags: tags.join(", ") };
}
