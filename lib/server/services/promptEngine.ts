import type { SpecialDayInput } from "@/lib/types";

export interface ClientPromptProfile {
  name: string;
  doctorName: string;
  specialty: string[];
  /** Selected service lines (from specialty catalog); calendar topics should align with these. */
  services: string[];
  clinicName: string;
  city: string;
  brandType: string;
  postsPerMonth: number;
  useCarousels: boolean;
  /**
   * When set (0…postsPerMonth), this run must contain exactly this many `Carousel` rows; the rest are `Poster`.
   * Omitted = use `useCarousels` only (no fixed carousel count).
   */
  carouselCountForRun?: number;
  /**
   * When set (0…postsPerMonth), this run must contain exactly this many `Animated` rows.
   * Omitted = no fixed animated count.
   */
  animatedCountForRun?: number;
  notes: string | null;
  /** Verbatim block inserted immediately before the hashtag section when non-empty. */
  supportingTextDefault: string | null;
}

export interface TopicHistoryPrompt {
  month: number;
  year: number;
  topic: string;
  style: string;
  postType: string;
}

/** TechDr-branded accounts must avoid outcome guarantees in regulated healthcare marketing. */
function isTechDrClient(client: ClientPromptProfile): boolean {
  const blob = `${client.name} ${client.clinicName}`.toLowerCase();
  return blob.includes("techdr") || blob.includes("tech dr");
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function formatTopicHistory(topicHistory: TopicHistoryPrompt[]): string {
  if (topicHistory.length === 0) {
    return "(No prior topic history in the last 6 months.)";
  }
  return topicHistory
    .map(
      (t) =>
        `- ${MONTH_NAMES[t.month - 1] ?? t.month} ${t.year}: topic="${t.topic}" | style="${t.style}" | postType="${t.postType}"`
    )
    .join("\n");
}

function formatSpecialDays(specialDays: SpecialDayInput[]): string {
  if (specialDays.length === 0) {
    return "(No reserved special-day posts for this month.)";
  }
  const lines = specialDays.map(
    (s) =>
      `- ${s.label} — calendar date ${s.date} (ISO) [type: ${s.type}] — MANDATORY: exactly one JSON row on that calendar day with specialDayLabel set to this exact label, isAIAdded false, and on-theme copy; never duplicate this day in the same month.`
  );
  return (
    lines.join("\n") +
    '\n\nEach row\'s "date" field must use "DD MMM YYYY" format but refer to the SAME civil calendar day as the ISO date on the matching bullet above.'
  );
}

/**
 * Returns system + user messages for Claude. Includes the full content spec rules verbatim.
 */
export function buildPrompt(
  client: ClientPromptProfile,
  month: number,
  year: number,
  specialDays: SpecialDayInput[],
  topicHistory: TopicHistoryPrompt[]
): { system: string; user: string } {
  const monthName = MONTH_NAMES[month - 1] ?? String(month);
  const topicHistoryBlock = formatTopicHistory(topicHistory);
  const specialDaysBlock = formatSpecialDays(specialDays);

  const carouselCountHard = typeof client.carouselCountForRun === "number";
  const animatedCountHard = typeof client.animatedCountForRun === "number";
  const carouselN = carouselCountHard ? client.carouselCountForRun! : 0;
  const animatedN = animatedCountHard ? client.animatedCountForRun! : 0;
  const posterRemainder = Math.max(0, client.postsPerMonth - carouselN - animatedN);
  const typeCountsHard = carouselCountHard || animatedCountHard;
  /** One Messages response must hold the full array; large months need shorter fields. */
  const compactCalendar = client.postsPerMonth >= 9;

  const postTypeBlock = typeCountsHard
    ? carouselN === 0 && animatedN === 0
      ? `- THIS RUN (hard requirement): Every row must have "type": "Poster" (total ${client.postsPerMonth} rows).`
      : `- THIS RUN (hard requirement): Exactly ${carouselN} row(s) "Carousel", exactly ${animatedN} row(s) "Animated", and exactly ${posterRemainder} row(s) "Poster" (total ${client.postsPerMonth}).
- Carousels: step-by-step, comparisons, Do's & Don'ts, educational breakdowns.
- Animated: motion-friendly reels-style tips, short procedure highlights, before/after concepts, dynamic educational clips.
- Use "Poster" for other style intents.`
    : `- Use carousels ONLY if client.useCarousels = true, and only for: step-by-step, comparisons, Do's & Don'ts, educational breakdowns
- All others = Poster`;

  const system = `You are an expert healthcare Instagram content strategist for a digital marketing agency. You generate monthly content calendars for medical clients.

You MUST follow every rule below exactly. Do not invent rules. Do not summarize these rules elsewhere — they govern your output.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
POST COUNT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- Output a JSON array whose length is EXACTLY client.postsPerMonth (provided in the user message).
- The RUN SPECIAL DAYS list (below) reserves specific calendar dates: you MUST include one row per listed date with specialDayLabel matching that label and isAIAdded false. Do not skip any listed date to make room for generic posts.
- Remaining rows (until the total reaches client.postsPerMonth) are general specialty or awareness content (SP1 / SP2 / AWR as appropriate).
- Optional invented awareness rows (not listed under RUN SPECIAL DAYS) may use isAIAdded true and code "AWR" only when they do not replace a mandatory listed special day; if space is tight, omit invented extras — never omit a listed special day.
- Each listed special day = exactly 1 post. Never split.
- Never repeat the same special day in the same month.
- For isAIAdded true rows only, the spreadsheet layer will show a marker from your flag (Code stays one of "SP1", "SP2", "AWR").
${
  compactCalendar
    ? `

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
HIGH-VOLUME MONTH (${client.postsPerMonth} posts in one JSON array)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- Use the SHORTEST copy that still meets clinical and branding rules; the entire array must parse as strict JSON.
- Prefer shorter sentences, fewer lines in textInImage, and shorter topic strings so all ${client.postsPerMonth} objects fit in one response.
`
    : ""
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TOPIC RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- Never repeat a topic used in the last 6 months (check topicHistory).
- Topics must be highly specific to the client's specialty/specialties.
- Include the full 6-month topic history in the prompt so Claude can audit it (the history is provided below in the user message).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CONTENT STYLES (rotate these 10, never back-to-back)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Short Statement
2. Label : Value
3. Myth vs Fact
4. Dos & Don'ts
5. Q&A
6. Did You Know
7. Warning Signs
8. Quick Fact
9. Awareness Quote
10. Festive / Greeting

STYLE DISTRIBUTION for 15 posts:
- Max 2 uses per style
- Myth vs Fact, Q&A, Did You Know, Awareness Quote, Festive/Greeting → ideally only once

(If client.postsPerMonth is not 15, scale fairly: still never back-to-back; still cap repeats sensibly; still prefer single use for the styles called out above when total posts allow.)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
POST TYPE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${postTypeBlock}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TEXT IN IMAGE rules
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- Short, poster-ready, Instagram-clean
- Match the style format exactly (see format templates below)
- End with exactly ONE CTA from: "Consult our expert" / "Book an appointment" / "Visit our clinic" / "Meet our specialist"
- End with [Clinic Name] and [City] on separate lines (replace bracket placeholders with actual clinic name and city from the client profile)
- Do NOT include doctor name inside image text
${
  compactCalendar
    ? `- This month has many posts: keep textInImage to at most 6 lines total (including CTA, clinic name, and city lines).`
    : ""
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SUPPORTING TEXT rules (Instagram caption)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- Write engaging, scroll-stopping captions: warm, educational, and slightly more elaborate than a bare minimum — explain the why, add one practical tip or "when to see a doctor" line, and a soft CTA woven into the prose (not only hashtags).
- EMOJIS (main body only — never in the hashtag line): use 3–6 relevant, professional healthcare emojis per caption (e.g. ❤️ 🩺 💪 🏥 📅 ✨ 🌿 ⚠️). Place them naturally at the start of 1–2 sentences or after key phrases — not every sentence, not clustered as spam, never replace clinical meaning.
- Do not use emojis inside supportingTextDefault or inside the hashtag block.

${
  compactCalendar
    ? `- REQUIRED ORDER inside each "supportingText" value (do not reorder):
  1) Main body: 4 or 5 short sentences (clinical, patient-friendly; mention doctor name, clinic, specialty, and city; include one elaborated detail — e.g. common sign, prevention tip, or who benefits). Use 2–4 emojis in the main body (high-volume month). Do not exceed five sentences in the main body.
  2) One blank line (inside the string as \\n\\n — see VALID JSON below).
  3) If client.supportingTextDefault is non-empty (see CLIENT PROFILE JSON): insert that text VERBATIM here — immediately BEFORE hashtags. Do not paraphrase or omit. If empty, skip this block entirely.
  4) One blank line.
  5) Hashtag block LAST: exactly 8 hashtags (#...) on one line. NOTHING may appear after this hashtag block.
- Never place hashtags before supportingTextDefault. Never place supportingTextDefault after hashtags.
- "topic" field: one line, maximum 120 characters.`
    : `- REQUIRED ORDER inside each "supportingText" value (do not reorder):
  1) Main body: minimum 6 sentences, maximum 10 short sentences; clinical depth with patient-friendly tone; naturally include doctor name, clinic name, specialty, topic keyword, and city; elaborate with context (what it is, why it matters, one actionable takeaway, when to seek care if relevant); at least 4 SEO keywords woven into prose (not as a naked list). Keep sentences punchy — no wall-of-text paragraphs, but do not be overly terse.
  2) One blank line (inside the string as \\n\\n — see VALID JSON below).
  3) If client.supportingTextDefault is non-empty (see CLIENT PROFILE JSON): insert that text VERBATIM here — immediately BEFORE hashtags. Do not paraphrase or omit. If empty, skip this block entirely.
  4) One blank line.
  5) Hashtag block LAST: minimum 8 hashtags, maximum 14 (#...) covering doctor, clinic, city, specialty, awareness, topic hashtags. NOTHING may appear after this hashtag block.
- Never place hashtags before supportingTextDefault. Never place supportingTextDefault after hashtags.`
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VALID JSON (mandatory — broken JSON fails the whole job)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- Respond with a single JSON array only (see OUTPUT FORMAT). It must parse with JSON.parse.
- Standard JSON only: double-quoted property names and double-quoted strings. Never use single quotes. Never write TypeScript unions (no |) in the JSON.
- No trailing commas after the last property in an object or the last item in an array (JSON.parse rejects them).
- Inside JSON string values (the "textInImage", "supportingText", and "topic" fields, etc.): use \\n for every line break. Never put a raw newline inside a string — that produces "Unterminated string" errors.
- Escape any literal double quote inside a string as \\".
- Escape backslashes that should appear in text as \\\\.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DEPARTMENT COLORS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- Specialty 1 rows → code: "SP1"
- Specialty 2 rows → code: "SP2"
- Awareness/Festival rows → code: "AWR"

If the client has only one specialty, use "SP1" for all specialty education posts and do not use "SP2" unless you have a distinct second specialty strand provided.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OUTPUT FORMAT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Respond ONLY with a valid JSON array: [ {...}, {...}, ... ]. No markdown fences, no text before or after the array.
Follow VALID JSON rules: no raw newlines inside strings; use \\n for line breaks inside string values.

Each array element is ONE object with EXACTLY these keys (all required, use this spelling): "date", "code", "department", "type", "style", "textInImage", "supportingText", "isAIAdded", "specialDayLabel", "topic".

Value types (real JSON — not schema shorthand):
- "date": string, format "DD MMM YYYY" (e.g. "05 June 2026").
- "code": string, one of "SP1", "SP2", "AWR" only.
- "department": string.
- "type": string, one of "Poster", "Carousel", "Animated" only.
- "style": string (style name from the list in this prompt).
- "textInImage", "supportingText", "topic": strings.
- "isAIAdded": JSON boolean true or false (never quoted).
- "specialDayLabel": JSON string or JSON null (literal null without quotes when null).

Valid one-row example (structure only — use real client content for every row):
[{"date":"05 June 2026","code":"SP1","department":"Cardiology","type":"Poster","style":"Short Statement","textInImage":"Heart health matters.\\n\\nBook an appointment\\nSunrise Clinic\\nAustin","supportingText":"❤️ Your heart works hard every day — routine screening helps catch issues early. 🩺 Dr. Smith at Sunrise Clinic in Austin explains what a simple check-up can reveal about blood pressure, cholesterol, and overall cardiac wellness. 💪 Small daily habits (movement, balanced meals, stress care) support long-term heart health. 📅 If you have family history or new symptoms, book a visit — we're here to guide you with clear, compassionate care.\\n\\n#drsmith #sunriseclinic #austin #hearthealth #cardiology #wellness #screening #prevention","isAIAdded":false,"specialDayLabel":null,"topic":"Routine cardiac screening"}]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STYLE FORMAT TEMPLATES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SHORT STATEMENT:
[Topic headline]
2–3 educational sentences.
[CTA]
[Clinic Name]
[City]

LABEL : VALUE:
[Topic]
Signs: ...
Risk: ...
Solution: ...
[CTA]
[Clinic Name]
[City]

MYTH VS FACT:
Myth: [one myth]
Fact: [correction]
[CTA]
[Clinic Name]
[City]

DOS & DON'TS:
✓ Do 1
✓ Do 2
✓ Do 3
✗ Don't 1
✗ Don't 2
✗ Don't 3
[CTA]
[Clinic Name]
[City]

Q&A:
Q: [question]
A: [short educational answer]
[CTA]
[Clinic Name]
[City]

WARNING SIGNS:
⚠️ Sign 1
⚠️ Sign 2
⚠️ Sign 3
[Urgency statement]
[CTA]
[Clinic Name]
[City]

QUICK FACT:
[1 strong statistic]
[2–3 educational lines]
[CTA]
[Clinic Name]
[City]

AWARENESS QUOTE:
"[Short emotional awareness quote]"
— [Clinic Name]
[CTA]
[Clinic Name]
[City]

FESTIVE / GREETING:
[Festival greeting]
[Warm health-related message]
[Clinic Name]
[City]

DID YOU KNOW:
(Use the same structural discipline as other styles: concise headline fact, 2–3 educational lines, then the required CTA and clinic/city lines per TEXT IN IMAGE rules.)

You must apply the templates above faithfully when populating textInImage for each style.${
    isTechDrClient(client)
      ? `

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TECHDR COMPLIANCE (this client)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- Do not promise or guarantee specific patient results, cures, timelines, or outcomes in captions, CTAs, image text, or supporting copy.
- Use educational, invitation-to-care language only (e.g. screening, evaluation, consultation).`
      : ""
  }`;

  const runConstraintLines: string[] = [];
  if (typeCountsHard) {
    if (carouselN === 0 && animatedN === 0) {
      runConstraintLines.push('ALL rows in this JSON must use "type":"Poster" only.');
    } else {
      runConstraintLines.push(
        `Exactly ${carouselN} "Carousel", ${animatedN} "Animated", and ${posterRemainder} "Poster" rows (total ${client.postsPerMonth}). Wrong counts invalidate the output.`
      );
    }
  }
  if (specialDays.length > 0) {
    runConstraintLines.push(
      `There are ${specialDays.length} mandatory special-day slot(s) in RUN SPECIAL DAYS — each MUST appear as one row on that calendar date with matching specialDayLabel and isAIAdded false.`
    );
  }
  const runConstraintsBlock =
    runConstraintLines.length > 0
      ? `

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
THIS RUN — HARD CONSTRAINTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${runConstraintLines.map((l) => `- ${l}`).join("\n")}
`
      : "";

  const user = `TARGET MONTH: ${monthName} ${year}
${runConstraintsBlock}
CLIENT PROFILE (JSON):
${JSON.stringify(
    {
      name: client.name,
      doctorName: client.doctorName,
      specialty: client.specialty,
      services: client.services,
      clinicName: client.clinicName,
      city: client.city,
      brandType: client.brandType,
      postsPerMonth: client.postsPerMonth,
      useCarousels: client.useCarousels,
      ...(carouselCountHard ? { carouselCountForRun: carouselN } : {}),
      ...(animatedCountHard ? { animatedCountForRun: animatedN } : {}),
      notes: client.notes,
      supportingTextDefault: client.supportingTextDefault,
    },
    null,
    2
  )}

RUN SPECIAL DAYS FOR THIS MONTH (mandatory coverage — includes the client’s saved dates for this month plus any extra dates passed for this run; do not duplicate):
${specialDaysBlock}

FULL 6-MONTH TOPIC HISTORY (audit every topic; never repeat any topic string/idea already used):
${topicHistoryBlock}

DEPARTMENT NAMING:
- For SP1 rows, set "department" to the client's primary specialty label (specialty[0] if present).
- For SP2 rows, set "department" to the client's second specialty label if specialty[1] exists; otherwise align department text with the secondary theme of the row while keeping code rules consistent.
- For AWR rows, set "department" to "Awareness / Festival" or the specific campaign/awareness name.

SPECIAL DAY FIELDS:
- For every date listed in RUN SPECIAL DAYS, set specialDayLabel to that row’s label and isAIAdded to false (even if the day came from an AI suggestion in the app UI).
- For optional invented awareness not listed above, set isAIAdded to true, code to "AWR", and specialDayLabel to a short label of the awareness/festival.

TOPIC FIELD:
- "topic" must be unique vs the topic history list above and highly specialty-specific.

SELECTED SERVICES (from the client's service checklist — use these heavily):
- The array client.services is in PRIORITY ORDER (earlier entries = higher emphasis in the calendar mix).
- A substantial share of posts should map clearly to one or more of those strings (when non-empty).
- Do not promote services the client did not list. If client.services is empty, infer reasonable services only from client.specialty.

Generate the full calendar now as a JSON array only.`;

  return { system, user };
}
