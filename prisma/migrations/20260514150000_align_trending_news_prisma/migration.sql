-- Align trending-news tables with Prisma schema. These ALTERs were removed from
-- `20260514124532_add_client_review_portal` because that migration runs *before*
-- the trending tables are created, which breaks Prisma's shadow database replay.

ALTER TABLE "TrendingNewsIngestionState" ALTER COLUMN "id" SET DEFAULT 'default';

ALTER TABLE "TrendingNewsItem" ALTER COLUMN "summary" SET DEFAULT '',
ALTER COLUMN "specialtyTags" DROP DEFAULT;

ALTER TABLE "NewsPosterSuggestion" ALTER COLUMN "recommendedSpecialtyTags" DROP DEFAULT,
ALTER COLUMN "complianceFlags" DROP DEFAULT;
