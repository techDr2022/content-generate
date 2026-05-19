import type { ClientBrandKit } from "./brandKit";

export const MEDICAL_SPECIALTIES = [
  "Gynaecology",
  "Cosmetic Gynecology",
  "Obstetrics",
  "Fertility & IVF",
  "Paediatrics",
  "Dermatology",
  "Cosmetology",
  "Orthopaedics",
  "Spine Surgery",
  "Cardiology",
  "Dentistry",
  "Physiotherapy",
  "Neurology",
  "Psychiatry & Mental Health",
  "Oncology",
  "Surgical Oncology",
  "Radiation Oncology",
  "Medical Oncology",
  "Hematology",
  "Hematology Oncology",
  "Ophthalmology",
  "ENT",
  "Gastroenterology",
  "Surgical Gastroenterology",
  "Medical Gastroenterology",
  "Hepatology",
  "Bariatric Surgery",
  "Nephrology",
  "Endocrinology & Diabetes",
  "Urology",
  "Andrology",
  "Pulmonology",
  "Rheumatology",
  "General Surgery",
  "General Medicine",
  "Ayurveda & Wellness",
  "Homeopathy",
  "Nutrition & Dietetics",
  "Anesthesiology",
  "Critical Care Medicine",
  "Emergency Medicine",
  "Geriatric Medicine",
  "Infectious Diseases",
  "Neonatology",
  "Pain Medicine",
  "Plastic & Reconstructive Surgery",
  "Radiology & Imaging",
  "Sports Medicine",
  "Vascular Surgery",
] as const;

export type MedicalSpecialty = (typeof MEDICAL_SPECIALTIES)[number];

/** Max number of specialty labels per client (catalog + custom combined). */
export const MAX_SPECIALTIES_PER_CLIENT = 20;

/** Max length for a custom (free-text) specialty label. */
export const MAX_CUSTOM_SPECIALTY_LENGTH = 80;

/** True if the label is exactly one of the built-in catalog specialties. */
export function isCatalogMedicalSpecialty(label: string): boolean {
  return (MEDICAL_SPECIALTIES as readonly string[]).includes(label);
}

/**
 * Validation message for a custom specialty draft, or null if empty or valid.
 * Rejects strings that only differ by case from a catalog entry (user should tick the checkbox).
 */
export function getCustomSpecialtyValidationMessage(raw: string): string | null {
  const t = raw.trim();
  if (t.length === 0) return null;
  if (t.length < 2) return "Enter at least 2 characters.";
  if (t.length > MAX_CUSTOM_SPECIALTY_LENGTH) {
    return `Keep it at or under ${MAX_CUSTOM_SPECIALTY_LENGTH} characters.`;
  }
  if (/[\r\n\t<>{}`\\]/.test(t)) {
    return "Remove line breaks, tabs, and the characters < > { } ` \\.";
  }
  if (MEDICAL_SPECIALTIES.some((m) => m.toLowerCase() === t.toLowerCase())) {
    return "That matches a catalog specialty — tick it in the list above.";
  }
  return null;
}

/** True if the string is a valid custom specialty (not in catalog; use isCatalogMedicalSpecialty first). */
export function isValidCustomSpecialtyName(raw: string): boolean {
  const t = raw.trim();
  return t.length >= 2 && getCustomSpecialtyValidationMessage(raw) === null;
}

export type BrandType = "clinic" | "personal" | "hospital";

export type SpecialDayType = "festival" | "awareness" | "campaign";

export interface SpecialDayInput {
  label: string;
  date: string;
  type: SpecialDayType;
}

export interface ClientDTO {
  id: string;
  name: string;
  doctorName: string;
  specialty: string[];
  /** Selected clinical / marketing services (subset of catalog for client's specialties). */
  services?: string[];
  clinicName: string;
  city: string;
  brandType: BrandType;
  /** Single-image Poster rows per month (0–30). */
  postsPerMonth: number;
  /** Fixed Carousel rows per month (0–10), added on top of postsPerMonth poster rows. */
  carouselsPerMonth?: number;
  useCarousels: boolean;
  /** Fixed Animated rows per month (0–10), added on top of posters and carousels. */
  animatedPerMonth?: number;
  notes: string | null;
  /** AI instructions for calendar and poster generation (not shown as internal notes). */
  generationNotes: string | null;
  /** If set, generation inserts this verbatim immediately before the hashtag block in supporting text. */
  supportingTextDefault: string | null;
  /** Brand colors, typography, grid, poster style defaults, and design guidelines. */
  brandKit?: ClientBrandKit | null;
  createdAt: string;
  updatedAt: string;
  userId: string;
  specialDays?: SpecialDayDTO[];
}

export interface SpecialDayDTO {
  id: string;
  clientId: string;
  label: string;
  date: string;
  type: SpecialDayType;
}

export interface TopicHistoryDTO {
  id: string;
  clientId: string;
  month: number;
  year: number;
  topic: string;
  style: string;
  postType: string;
  createdAt: string;
}
