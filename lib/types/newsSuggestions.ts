import type { PosterLookId } from "@/lib/types";

export interface NewsSourceRef {
  name: string;
  url: string;
  publishedAt: string;
}

export interface NewsItemDTO {
  id: string;
  clusterId: string;
  sources: NewsSourceRef[];
  primaryHeadline: string;
  summary: string;
  specialtyTags: string[];
  relevanceScore: number;
  fetchedAt: string;
}

export type VisualMood = "clinical" | "warm" | "urgent" | "educational";

export interface PosterSuggestionDTO {
  id: string;
  newsItemId: string;
  headlines: string[];
  keyTakeaway: string;
  visualDirection: {
    palette: string[];
    mood: VisualMood;
    iconHints: string[];
  };
  recommendedSpecialtyTags: string[];
  cta: string;
  complianceStatus: "passed" | "flagged" | "manual_review";
  complianceFlags: string[];
}

export interface TrendingNewsCardDTO {
  news: NewsItemDTO;
  suggestion: PosterSuggestionDTO | null;
  user: { saved: boolean; dismissed: boolean };
}

export interface TrendingPosterPrefillV1 {
  v: 1;
  textInImage: string;
  posterLook: PosterLookId;
  posterLookCustom?: string;
  headline: string;
  keyTakeaway: string;
  cta: string;
  sourceUrl?: string;
  variantIndex: number;
}
