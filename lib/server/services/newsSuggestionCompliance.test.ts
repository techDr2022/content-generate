import { describe, expect, it } from "vitest";
import {
  validateNewsPosterSuggestion,
  countWords,
  moodToPosterLook,
  buildPosterLookCustomFromVisual,
} from "./newsSuggestionCompliance";

const validBase = {
  headlines: [
    "A clearer name for a common syndrome",
    "Understanding the PMOS update together",
    "What the new term means for patients",
  ],
  keyTakeaway:
    "Experts published a consensus update. It is a naming and framing change; speak with your clinician about what it means for you.",
  visualDirection: {
    palette: ["soft teal", "warm white", "slate"],
    mood: "educational",
    iconHints: ["stethoscope outline", "calendar"],
  },
  cta: "Talk to your doctor",
  recommendedSpecialtyTags: ["Endocrinology", "Gynecology"],
} as const;

describe("validateNewsPosterSuggestion", () => {
  it("passes clean compliant content", () => {
    const r = validateNewsPosterSuggestion({ ...validBase });
    expect(r.ok).toBe(true);
    expect(r.status).toBe("passed");
    expect(r.flags).toHaveLength(0);
  });

  it("flags wrong headline count", () => {
    const r = validateNewsPosterSuggestion({
      ...validBase,
      headlines: validBase.headlines.slice(0, 2),
    });
    expect(r.ok).toBe(false);
    expect(r.flags.some((f) => f.includes("headlines"))).toBe(true);
  });

  it("flags headline over 8 words", () => {
    const r = validateNewsPosterSuggestion({
      ...validBase,
      headlines: [
        "one two three four five six seven eight nine",
        validBase.headlines[1],
        validBase.headlines[2],
      ],
    });
    expect(r.ok).toBe(false);
    expect(r.flags.some((f) => f.includes("exceeds 8 words"))).toBe(true);
  });

  it("flags forbidden guarantee language in takeaway", () => {
    const r = validateNewsPosterSuggestion({
      ...validBase,
      keyTakeaway: "This treatment is guaranteed to help everyone.",
    });
    expect(r.ok).toBe(false);
    expect(r.flags.some((f) => f.startsWith("forbidden:guarantee_language"))).toBe(true);
  });

  it("flags cure language", () => {
    const r = validateNewsPosterSuggestion({
      ...validBase,
      keyTakeaway: "Many patients hope this update will cure all symptoms overnight.",
    });
    expect(r.ok).toBe(false);
    expect(r.flags.some((f) => f.includes("forbidden:outcome_promises"))).toBe(true);
  });

  it("flags quantified success rate", () => {
    const r = validateNewsPosterSuggestion({
      ...validBase,
      keyTakeaway: "Studies report 98% success rate for this approach.",
    });
    expect(r.ok).toBe(false);
    expect(r.flags.some((f) => f.includes("forbidden:quantified_results"))).toBe(true);
  });

  it("flags superlatives", () => {
    const r = validateNewsPosterSuggestion({
      ...validBase,
      headlines: ["We are the best clinic for PMOS news", validBase.headlines[1], validBase.headlines[2]],
    });
    expect(r.ok).toBe(false);
    expect(r.flags.some((f) => f.includes("forbidden:superlatives"))).toBe(true);
  });

  it("flags before and after phrasing", () => {
    const r = validateNewsPosterSuggestion({
      ...validBase,
      keyTakeaway: "See dramatic before and after results in one week.",
    });
    expect(r.ok).toBe(false);
    expect(r.flags.some((f) => f.includes("forbidden:before_after"))).toBe(true);
  });

  it("flags comparative provider claims", () => {
    const r = validateNewsPosterSuggestion({
      ...validBase,
      keyTakeaway: "We are better than other clinics in your city.",
    });
    expect(r.ok).toBe(false);
    expect(r.flags.some((f) => f.includes("forbidden:comparative_providers"))).toBe(true);
  });

  it("flags CTA not on whitelist", () => {
    const r = validateNewsPosterSuggestion({
      ...validBase,
      cta: "Call now for miracle cures",
    });
    expect(r.ok).toBe(false);
    expect(r.flags.some((f) => f.includes("cta:"))).toBe(true);
  });

  it("accepts exact approved CTA casing", () => {
    const r = validateNewsPosterSuggestion({
      ...validBase,
      cta: "Schedule a screening",
    });
    expect(r.ok).toBe(true);
  });
});

describe("countWords", () => {
  it("counts trimmed words", () => {
    expect(countWords("  hello   world  ")).toBe(2);
    expect(countWords("")).toBe(0);
  });
});

describe("moodToPosterLook", () => {
  it("maps known moods", () => {
    expect(moodToPosterLook("clinical")).toBe("minimal_clean");
    expect(moodToPosterLook("WARM")).toBe("soft_medical");
    expect(moodToPosterLook("urgent")).toBe("bold_marketing");
    expect(moodToPosterLook("educational")).toBe("flat_illustration");
  });

  it("defaults unknown mood", () => {
    expect(moodToPosterLook("mysterious")).toBe("soft_medical");
  });
});

describe("buildPosterLookCustomFromVisual", () => {
  it("truncates to 500 chars", () => {
    const long = buildPosterLookCustomFromVisual({
      palette: Array(40).fill("navy blue"),
      iconHints: ["hint"],
    });
    expect(long.length).toBeLessThanOrEqual(500);
  });
});
