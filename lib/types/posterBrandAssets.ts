/** Max base64 string length per image (generous ceiling for ~8MB binary). */
export const POSTER_BRAND_IMAGE_MAX_CHARS = 12_000_000;

/** Max decoded bytes per uploaded reference image (logo / doctor photo). */
export const POSTER_BRAND_IMAGE_MAX_BYTES = 8 * 1024 * 1024;

/** Max characters for contact / footer copy sent with the poster prompt. */
export const POSTER_CONTACT_DETAILS_MAX_CHARS = 2000;

export interface PosterBrandAssetsState {
  contactDetails: string;
  logoBase64: string | null;
  logoMimeType: string | null;
  doctorPhotoBase64: string | null;
  doctorPhotoMimeType: string | null;
}

export function defaultPosterBrandAssetsState(): PosterBrandAssetsState {
  return {
    contactDetails: "",
    logoBase64: null,
    logoMimeType: null,
    doctorPhotoBase64: null,
    doctorPhotoMimeType: null,
  };
}

/** JSON fields for `/api/images/generate` (base64 without `data:` prefix). */
export interface PosterBrandAssetsPayload {
  contactDetails?: string;
  logoBase64?: string;
  logoMimeType?: string;
  doctorPhotoBase64?: string;
  doctorPhotoMimeType?: string;
}

export function posterBrandPayloadFromState(s: PosterBrandAssetsState): PosterBrandAssetsPayload {
  const contact = s.contactDetails.trim();
  return {
    ...(contact ? { contactDetails: contact } : {}),
    ...(s.logoBase64 && s.logoMimeType ? { logoBase64: s.logoBase64, logoMimeType: s.logoMimeType } : {}),
    ...(s.doctorPhotoBase64 && s.doctorPhotoMimeType
      ? { doctorPhotoBase64: s.doctorPhotoBase64, doctorPhotoMimeType: s.doctorPhotoMimeType }
      : {}),
  };
}
