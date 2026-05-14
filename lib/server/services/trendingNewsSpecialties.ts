import { MEDICAL_SPECIALTIES } from "@/lib/types";

const KEYWORDS: { re: RegExp; tag: (typeof MEDICAL_SPECIALTIES)[number] }[] = [
  { re: /\b(pcos|pmos|ovarian|gynec|gynaec|uterus|cervix|pap|menopause|pregnancy|obstetric|fertility|ivf)\b/i, tag: "Gynaecology" },
  { re: /\b(pregnancy|birth|neonatal|obstetric|labor|delivery)\b/i, tag: "Obstetrics" },
  { re: /\b(fertility|ivf|iui|embryo)\b/i, tag: "Fertility & IVF" },
  { re: /\b(child|pediatric|paediatric|infant|vaccin)\b/i, tag: "Paediatrics" },
  { re: /\b(heart|cardiac|stroke|hypertension|cholesterol)\b/i, tag: "Cardiology" },
  { re: /\b(diabetes|insulin|thyroid|endocrine|hormone|metabolic)\b/i, tag: "Endocrinology & Diabetes" },
  { re: /\b(cancer|oncology|tumor|chemo|radiation)\b/i, tag: "Oncology" },
  { re: /\b(covid|influenza|virus|infection|who|cdc|outbreak)\b/i, tag: "Infectious Diseases" },
  { re: /\b(mental|depression|anxiety|psychiatr)\b/i, tag: "Psychiatry & Mental Health" },
  { re: /\b(primary care|family medicine|gp\b|general practice)\b/i, tag: "General Medicine" },
  { re: /\b(kidney|renal|dialysis)\b/i, tag: "Nephrology" },
  { re: /\b(lung|asthma|copd|pulmon)\b/i, tag: "Pulmonology" },
  { re: /\b(brain|neuro|seizure|migraine)\b/i, tag: "Neurology" },
  { re: /\b(gut|colon|liver|hepat|ibd|endoscop)\b/i, tag: "Gastroenterology" },
  { re: /\b(eye|vision|retina|glaucoma|ophthalm)\b/i, tag: "Ophthalmology" },
  { re: /\b(skin|dermat|psoriasis|eczema|acne)\b/i, tag: "Dermatology" },
  { re: /\b(bone|joint|orthop|arthritis|fracture)\b/i, tag: "Orthopaedics" },
];

export function inferSpecialtyTagsFromHeadline(headline: string, summary: string): string[] {
  const blob = `${headline}\n${summary}`;
  const tags = new Set<string>();
  for (const k of KEYWORDS) {
    if (k.re.test(blob)) tags.add(k.tag);
  }
  if (tags.size === 0) tags.add("General Medicine");
  return [...tags].slice(0, 6);
}

export function catalogSpecialtiesForPrompt(): string {
  return MEDICAL_SPECIALTIES.join(", ");
}
