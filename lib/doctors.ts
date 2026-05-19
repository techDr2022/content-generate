import type { BrandType } from "@/lib/types/client";

export const DOCTOR_NAME_SEPARATOR = ", ";

export function doctorsToDoctorName(doctors: string[], brandType: BrandType): string {
  const trimmed = doctors.map((d) => d.trim()).filter(Boolean);
  if (trimmed.length === 0) return "";
  if (brandType === "personal") return trimmed[0]!;
  return trimmed.join(DOCTOR_NAME_SEPARATOR);
}

export function parseDoctorNames(doctorName: string, brandType: BrandType): string[] {
  const name = doctorName.trim();
  if (!name) return [];
  if (brandType === "personal") return [name];
  const parts = name.split(DOCTOR_NAME_SEPARATOR).map((s) => s.trim()).filter(Boolean);
  return parts.length > 0 ? parts : [name];
}

/** Pick which doctor to feature on a poster (bulk index). */
export function resolveDoctorForPosterIndex(
  doctors: string[],
  index: number,
  rotateDoctors: boolean
): string {
  if (doctors.length === 0) return "";
  if (!rotateDoctors || doctors.length === 1) return doctors[0]!;
  return doctors[index % doctors.length]!;
}
