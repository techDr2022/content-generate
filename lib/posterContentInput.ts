/** Structured poster copy fields matching the design system content input spec. */

export interface PosterContentInput {
  headline: string;
  subheadline: string;
  bodyCopy: string;
  cta: string;
  offer: string;
  disclaimer: string;
  hashtags: string;
}

export function emptyPosterContentInput(): PosterContentInput {
  return {
    headline: "",
    subheadline: "",
    bodyCopy: "",
    cta: "",
    offer: "",
    disclaimer: "",
    hashtags: "",
  };
}

/** Build the text block sent to the image model from structured fields. */
export function buildPosterTextFromContentInput(input: PosterContentInput): string {
  const lines: string[] = [];
  const push = (label: string, value: string) => {
    const t = value.trim();
    if (t) lines.push(`${label}: ${t}`);
  };

  push("Headline", input.headline);
  push("Subheadline", input.subheadline);
  push("Body Copy", input.bodyCopy);
  push("CTA", input.cta);
  push("Offer", input.offer);
  push("Disclaimer", input.disclaimer);
  if (input.hashtags.trim()) {
    push("Hashtags", input.hashtags.trim());
  }

  return lines.join("\n");
}

export function posterContentInputHasText(input: PosterContentInput): boolean {
  return Boolean(buildPosterTextFromContentInput(input).trim());
}
