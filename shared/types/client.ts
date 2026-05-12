export const MEDICAL_SPECIALTIES = [
  "Gynaecology",
  "Fertility & IVF",
  "Paediatrics",
  "Dermatology & Cosmetology",
  "Orthopaedics",
  "Cardiology",
  "Dentistry",
  "Physiotherapy",
  "Neurology",
  "Psychiatry & Mental Health",
  "Oncology",
  "Ophthalmology",
  "ENT",
  "Gastroenterology",
  "Nephrology",
  "Endocrinology & Diabetes",
  "Urology",
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
  postsPerMonth: number;
  useCarousels: boolean;
  notes: string | null;
  /** If set, generation inserts this verbatim immediately before the hashtag block in supporting text. */
  supportingTextDefault: string | null;
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
