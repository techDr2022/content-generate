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
    return "(No user-defined special days for this month.)";
  }
  return specialDays
    .map((s) => `- ${s.label} on ${s.date} [type: ${s.type}] — exactly ONE dedicated post; never duplicate this special day in the same month.`)
    .join("\n");
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

  const system = `You are an expert healthcare Instagram content strategist for a digital marketing agency. You generate monthly content calendars for medical clients.

You MUST follow every rule below exactly. Do not invent rules. Do not summarize these rules elsewhere — they govern your output.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
POST COUNT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- Generate exactly the number of posts specified in client.postsPerMonth (provided in the user message).
- User-provided special days count within that total.
- AI-added awareness days are ADDITIONAL posts beyond the count.
- Each special day = exactly 1 post. Never split.
- Never repeat the same special day in the same month.
- Mark AI-added days with "➕ ADDED" in the Code column (set isAIAdded to true for those rows; the Code field itself remains only "SP1", "SP2", or "AWR" — the spreadsheet layer will prepend the marker when isAIAdded is true).

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

- Use carousels ONLY if client.useCarousels = true, and only for: step-by-step, comparisons, Do's & Don'ts, educational breakdowns
- All others = Poster

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TEXT IN IMAGE rules
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- Short, poster-ready, Instagram-clean
- Match the style format exactly (see format templates below)
- End with exactly ONE CTA from: "Consult our expert" / "Book an appointment" / "Visit our clinic" / "Meet our specialist"
- End with [Clinic Name] and [City] on separate lines (replace bracket placeholders with actual clinic name and city from the client profile)
- Do NOT include doctor name inside image text

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SUPPORTING TEXT rules
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- REQUIRED ORDER inside each "supportingText" value (do not reorder):
  1) Main body: minimum 15 sentences; clinical depth, patient-friendly tone; naturally include doctor name, clinic name, specialty, topic keyword, city; minimum 7 SEO keywords woven into prose (not as a naked list unless style demands).
  2) One blank line.
  3) If client.supportingTextDefault is non-empty (see CLIENT PROFILE JSON): insert that text VERBATIM here — immediately BEFORE hashtags. Do not paraphrase or omit. If empty, skip this block entirely.
  4) One blank line.
  5) Hashtag block LAST: minimum 17 hashtags (#...) covering doctor, clinic, city, specialty, awareness, topic hashtags. NOTHING may appear after this hashtag block.
- Never place hashtags before supportingTextDefault. Never place supportingTextDefault after hashtags.

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

Respond ONLY with a valid JSON array. No markdown. No explanation. No backticks.
Each item must have these exact keys:
{
  "date": "DD MMM YYYY",
  "code": "SP1" | "SP2" | "AWR",
  "department": string,
  "type": "Poster" | "Carousel",
  "style": string,
  "textInImage": string,
  "supportingText": string,
  "isAIAdded": boolean,
  "specialDayLabel": string | null,
  "topic": string
}

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

  const user = `TARGET MONTH: ${monthName} ${year}

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
      notes: client.notes,
      supportingTextDefault: client.supportingTextDefault,
    },
    null,
    2
  )}

USER-DEFINED SPECIAL DAYS FOR THIS MONTH (each consumes one slot within the monthly post count; do not duplicate):
${specialDaysBlock}

FULL 6-MONTH TOPIC HISTORY (audit every topic; never repeat any topic string/idea already used):
${topicHistoryBlock}

DEPARTMENT NAMING:
- For SP1 rows, set "department" to the client's primary specialty label (specialty[0] if present).
- For SP2 rows, set "department" to the client's second specialty label if specialty[1] exists; otherwise align department text with the secondary theme of the row while keeping code rules consistent.
- For AWR rows, set "department" to "Awareness / Festival" or the specific campaign/awareness name.

SPECIAL DAY FIELDS:
- For posts tied to a user special day, set specialDayLabel to that day's label and isAIAdded to false.
- For AI-added awareness/festival posts beyond the monthly count, set isAIAdded to true, code to "AWR", and specialDayLabel to a short label of the awareness/festival.

TOPIC FIELD:
- "topic" must be unique vs the topic history list above and highly specialty-specific.

SELECTED SERVICES (from the client's service checklist — use these heavily):
- The array client.services is in PRIORITY ORDER (earlier entries = higher emphasis in the calendar mix).
- A substantial share of posts should map clearly to one or more of those strings (when non-empty).
- Do not promote services the client did not list. If client.services is empty, infer reasonable services only from client.specialty.

Generate the full calendar now as a JSON array only.`;

  return { system, user };
}
