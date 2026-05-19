import type { CalendarPost, PostType } from "@/lib/types";
import { logger } from "../logger";

export interface CalendarTypeTargets {
  poster: number;
  carousel: number;
  animated: number;
}

const CAROUSEL_STYLES = new Set(["Dos & Don'ts", "Myth vs Fact", "Label : Value"]);
const ANIMATED_STYLES = new Set([
  "Short Statement",
  "Quick Fact",
  "Did You Know",
  "Q&A",
  "Warning Signs",
]);

function countTypes(posts: CalendarPost[]): Record<PostType, number> {
  const counts: Record<PostType, number> = { Poster: 0, Carousel: 0, Animated: 0 };
  for (const p of posts) {
    if (p.type === "Carousel" || p.type === "Animated" || p.type === "Poster") {
      counts[p.type] += 1;
    } else {
      counts.Poster += 1;
    }
  }
  return counts;
}

function scoreForCarousel(post: CalendarPost): number {
  if (CAROUSEL_STYLES.has(post.style)) return 10;
  if (post.textInImage.includes("✓") || post.textInImage.includes("✗")) return 8;
  if (/myth|fact/i.test(post.textInImage)) return 7;
  return 1;
}

function scoreForAnimated(post: CalendarPost): number {
  if (ANIMATED_STYLES.has(post.style)) return 10;
  if (post.type === "Animated") return 9;
  return 2;
}

function pickIndicesToReassign(
  posts: CalendarPost[],
  fromType: PostType,
  count: number,
  scoreFn: (p: CalendarPost) => number
): number[] {
  const candidates = posts
    .map((p, i) => ({ i, p, score: p.type === fromType ? scoreFn(p) : -1 }))
    .filter((c) => c.score >= 0)
    .sort((a, b) => b.score - a.score);
  return candidates.slice(0, count).map((c) => c.i);
}

function ensureAnimatedCopy(post: CalendarPost): CalendarPost {
  const text = post.textInImage.trim();
  const hasMotionCue =
    /▶|reel|motion|watch|swipe|seconds|tip:/i.test(text) || text.startsWith("Hook:");
  if (hasMotionCue) return { ...post, type: "Animated" };

  const hook =
    post.style === "Warning Signs"
      ? "▶ Watch for these signs:"
      : post.style === "Q&A"
        ? "▶ Quick Q&A:"
        : "▶ Reel tip:";

  const lines = text.replace(/\\n/g, "\n").split(/\r?\n/).filter((l) => l.trim().length > 0);
  const body = lines.length > 0 ? lines.join("\n") : text;
  return {
    ...post,
    type: "Animated",
    textInImage: `${hook}\n${body}`,
  };
}

/**
 * Reassigns row `type` values so Poster / Carousel / Animated counts match run targets.
 * Does not add or remove rows — only relabels (and lightly adjusts Animated image text).
 */
export function enforceCalendarTypeCounts(
  posts: CalendarPost[],
  targets: CalendarTypeTargets
): CalendarPost[] {
  const total = posts.length;
  const wantPoster = Math.max(0, targets.poster);
  const wantCarousel = Math.max(0, targets.carousel);
  const wantAnimated = Math.max(0, targets.animated);

  if (wantPoster + wantCarousel + wantAnimated !== total) {
    logger.warn("Type targets do not sum to post count; skipping enforcement", {
      total,
      wantPoster,
      wantCarousel,
      wantAnimated,
    });
    return posts;
  }

  const before = countTypes(posts);
  const next = posts.map((p) => ({ ...p }));
  let counts = countTypes(next);

  const needAnimated = wantAnimated - counts.Animated;
  if (needAnimated > 0) {
    const fromPoster = pickIndicesToReassign(next, "Poster", needAnimated, scoreForAnimated);
    for (const i of fromPoster) {
      next[i] = ensureAnimatedCopy(next[i]!);
    }
    counts = countTypes(next);
  }

  const needCarousel = wantCarousel - counts.Carousel;
  if (needCarousel > 0) {
    const fromPoster = pickIndicesToReassign(next, "Poster", needCarousel, scoreForCarousel);
    for (const i of fromPoster) {
      next[i] = { ...next[i]!, type: "Carousel" };
    }
    counts = countTypes(next);
  }

  const excessAnimated = counts.Animated - wantAnimated;
  if (excessAnimated > 0) {
    const indices = next
      .map((p, i) => ({ i, p }))
      .filter(({ p }) => p.type === "Animated")
      .sort((a, b) => scoreForAnimated(a.p) - scoreForAnimated(b.p))
      .slice(0, excessAnimated)
      .map(({ i }) => i);
    for (const i of indices) {
      next[i] = { ...next[i]!, type: "Poster" };
    }
    counts = countTypes(next);
  }

  const excessCarousel = counts.Carousel - wantCarousel;
  if (excessCarousel > 0) {
    const indices = next
      .map((p, i) => ({ i, p }))
      .filter(({ p }) => p.type === "Carousel")
      .sort((a, b) => scoreForCarousel(a.p) - scoreForCarousel(b.p))
      .slice(0, excessCarousel)
      .map(({ i }) => i);
    for (const i of indices) {
      next[i] = { ...next[i]!, type: "Poster" };
    }
    counts = countTypes(next);
  }

  const finalCounts = countTypes(next);
  if (
    finalCounts.Poster !== wantPoster ||
    finalCounts.Carousel !== wantCarousel ||
    finalCounts.Animated !== wantAnimated
  ) {
    logger.warn("Could not fully enforce calendar type counts", {
      want: { wantPoster, wantCarousel, wantAnimated },
      got: finalCounts,
    });
  } else if (
    before.Poster !== finalCounts.Poster ||
    before.Carousel !== finalCounts.Carousel ||
    before.Animated !== finalCounts.Animated
  ) {
    logger.info("Adjusted calendar type counts after Claude generation", {
      before,
      after: finalCounts,
    });
  }

  return next;
}
