export type PostCode = "SP1" | "SP2" | "AWR";

export type PostType = "Poster" | "Carousel";

export interface CalendarPost {
  date: string;
  code: PostCode;
  department: string;
  type: PostType;
  style: string;
  textInImage: string;
  supportingText: string;
  isAIAdded: boolean;
  specialDayLabel: string | null;
  topic: string;
}

export const CONTENT_STYLES = [
  "Short Statement",
  "Label : Value",
  "Myth vs Fact",
  "Dos & Don'ts",
  "Q&A",
  "Did You Know",
  "Warning Signs",
  "Quick Fact",
  "Awareness Quote",
  "Festive / Greeting",
] as const;
