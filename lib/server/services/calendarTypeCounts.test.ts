import { describe, expect, it } from "vitest";
import type { CalendarPost } from "@/lib/types";
import { enforceCalendarTypeCounts } from "./calendarTypeCounts";

function row(overrides: Partial<CalendarPost> & Pick<CalendarPost, "style">): CalendarPost {
  return {
    date: "05 June 2026",
    code: "SP1",
    department: "Cardiology",
    type: "Poster",
    textInImage: overrides.textInImage ?? "Heart tip\n\nBook an appointment\nClinic\nCity",
    supportingText: overrides.supportingText ?? "Caption body.\n\n#tag1 #tag2",
    isAIAdded: false,
    specialDayLabel: null,
    topic: overrides.topic ?? "Topic",
    ...overrides,
  };
}

describe("enforceCalendarTypeCounts", () => {
  it("converts posters to animated when animated count is short", () => {
    const posts = [
      row({ style: "Short Statement", topic: "a" }),
      row({ style: "Dos & Don'ts", topic: "b" }),
      row({ style: "Quick Fact", topic: "c" }),
    ];
    const out = enforceCalendarTypeCounts(posts, { poster: 1, carousel: 1, animated: 1 });
    expect(out.filter((p) => p.type === "Animated")).toHaveLength(1);
    expect(out.filter((p) => p.type === "Carousel")).toHaveLength(1);
    expect(out.filter((p) => p.type === "Poster")).toHaveLength(1);
    const animated = out.find((p) => p.type === "Animated");
    expect(animated?.textInImage).toMatch(/▶/);
  });

  it("leaves counts unchanged when already correct", () => {
    const posts = [
      row({ type: "Poster", style: "Short Statement" }),
      row({ type: "Carousel", style: "Myth vs Fact" }),
      row({ type: "Animated", style: "Quick Fact", textInImage: "▶ Reel tip:\nLine\n\nCTA\nClinic\nCity" }),
    ];
    const out = enforceCalendarTypeCounts(posts, { poster: 1, carousel: 1, animated: 1 });
    expect(out.map((p) => p.type)).toEqual(["Poster", "Carousel", "Animated"]);
  });
});
