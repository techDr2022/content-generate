import type { CalendarPost } from "@/lib/types";
import type { ClientPromptProfile, TopicHistoryPrompt } from "./promptEngine";
import { generateCalendarWithClaude, parseJsonArrayFromClaudeText } from "./claudeService";
import { logger } from "../logger";

export function isCalendarContentReviewEnabled(): boolean {
  const raw = process.env.CALENDAR_CONTENT_REVIEW?.trim().toLowerCase();
  if (raw === "0" || raw === "false" || raw === "off") return false;
  return true;
}

function buildReviewSystem(compact: boolean): string {
  return `You are a senior healthcare social content editor. You receive a completed monthly Instagram calendar as JSON.

Your job: review EVERY row and return an improved JSON array of the SAME length and order.

Rules:
- Keep "date", "code", "department", "isAIAdded", and "specialDayLabel" unchanged unless clearly wrong vs the client brief.
- Fix "supportingText" structure: main body, then optional supportingTextDefault block (verbatim if provided), then hashtags last. Use \\n for line breaks inside strings.
- Fix "textInImage" to match the row's "style" template and end with one CTA + clinic + city lines.
- Never promise cures or guaranteed outcomes (healthcare compliance).
- Do not remove mandatory special-day rows or change their calendar dates.

POST TYPE (critical):
- Rows with "type":"Animated" are Instagram Reels / short video scripts — NOT static posters.
  - "textInImage" must open with a motion hook (e.g. "▶ Reel tip:", "▶ Watch:", "▶ Quick Q&A:") and use short, punchy lines suitable for on-screen captions over video (max ~6 lines including CTA/clinic/city).
  - "supportingText" should mention watching the reel / short video naturally once.
- Rows with "type":"Carousel" need stepwise or slide-friendly "textInImage" (lists, Myth/Fact, Do's/Don'ts).
- Rows with "type":"Poster" stay static single-image copy.

${
  compact
    ? `- This is a high-volume month: keep edits minimal but fix clear errors; preserve topics; shorten only if strings break JSON limits.`
    : `- Improve weak captions with patient-friendly depth; keep doctor, clinic, specialty, and city woven in.`
}

Output ONLY a valid JSON array. Same keys per object as input: date, code, department, type, style, textInImage, supportingText, isAIAdded, specialDayLabel, topic.
No markdown fences. Use JSON.parse-safe strings only (\\n for newlines).`;
}

function buildReviewUser(
  client: ClientPromptProfile,
  posts: CalendarPost[],
  topicHistory: TopicHistoryPrompt[]
): string {
  const animatedN = posts.filter((p) => p.type === "Animated").length;
  const carouselN = posts.filter((p) => p.type === "Carousel").length;

  return `CLIENT:
${JSON.stringify(
    {
      doctorName: client.doctorName,
      clinicName: client.clinicName,
      city: client.city,
      specialty: client.specialty,
      services: client.services,
      supportingTextDefault: client.supportingTextDefault,
    },
    null,
    2
  )}

TYPE TARGETS IN THIS ARRAY: ${posts.filter((p) => p.type === "Poster").length} Poster, ${carouselN} Carousel, ${animatedN} Animated (do not change type counts).

TOPIC HISTORY (do not reuse topics):
${topicHistory.map((t) => `- ${t.topic}`).join("\n") || "(none)"}

CALENDAR JSON TO REVIEW AND UPDATE:
${JSON.stringify(posts)}`;
}

/**
 * Second Claude pass: polish copy, fix caption/hashtag order, and strengthen Animated (reel) rows.
 */
export async function reviewAndRefineCalendarPosts(
  posts: CalendarPost[],
  client: ClientPromptProfile,
  topicHistory: TopicHistoryPrompt[]
): Promise<CalendarPost[]> {
  if (posts.length === 0) return posts;

  const compact = posts.length >= 9;
  const system = buildReviewSystem(compact);
  const user = buildReviewUser(client, posts, topicHistory);

  logger.info("Calendar content review starting", {
    rowCount: posts.length,
    animated: posts.filter((p) => p.type === "Animated").length,
    carousel: posts.filter((p) => p.type === "Carousel").length,
  });

  const reviewed = await generateCalendarWithClaude(system, user);

  if (!Array.isArray(reviewed) || reviewed.length !== posts.length) {
    logger.warn("Content review returned unexpected length; keeping pre-review calendar", {
      expected: posts.length,
      got: Array.isArray(reviewed) ? reviewed.length : typeof reviewed,
    });
    return posts;
  }

  return reviewed as CalendarPost[];
}

/** Parse review response when using a lighter direct Messages call (tests). */
export function parseReviewResponse(raw: string): unknown {
  return parseJsonArrayFromClaudeText(raw);
}
