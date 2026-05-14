-- Trending healthcare news + poster suggestions

CREATE TABLE "TrendingNewsIngestionState" (
    "id" TEXT NOT NULL,
    "lastRunAt" TIMESTAMP(3),
    "lastOkAt" TIMESTAMP(3),
    "lastError" TEXT,
    CONSTRAINT "TrendingNewsIngestionState_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TrendingNewsItem" (
    "id" TEXT NOT NULL,
    "clusterId" TEXT NOT NULL,
    "primaryHeadline" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "specialtyTags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "relevanceScore" DOUBLE PRECISION NOT NULL,
    "sources" JSONB NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TrendingNewsItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TrendingNewsItem_clusterId_key" ON "TrendingNewsItem"("clusterId");

CREATE TABLE "NewsPosterSuggestion" (
    "id" TEXT NOT NULL,
    "newsItemId" TEXT NOT NULL,
    "headlines" TEXT[] NOT NULL,
    "keyTakeaway" TEXT NOT NULL,
    "visualDirection" JSONB NOT NULL,
    "recommendedSpecialtyTags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "cta" TEXT NOT NULL,
    "complianceStatus" TEXT NOT NULL,
    "complianceFlags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NewsPosterSuggestion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserTrendingNewsState" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "newsItemId" TEXT NOT NULL,
    "saved" BOOLEAN NOT NULL DEFAULT false,
    "dismissed" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "UserTrendingNewsState_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NewsPosterSuggestion_newsItemId_key" ON "NewsPosterSuggestion"("newsItemId");
CREATE UNIQUE INDEX "UserTrendingNewsState_userId_newsItemId_key" ON "UserTrendingNewsState"("userId", "newsItemId");
CREATE INDEX "UserTrendingNewsState_userId_idx" ON "UserTrendingNewsState"("userId");

ALTER TABLE "NewsPosterSuggestion" ADD CONSTRAINT "NewsPosterSuggestion_newsItemId_fkey" FOREIGN KEY ("newsItemId") REFERENCES "TrendingNewsItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserTrendingNewsState" ADD CONSTRAINT "UserTrendingNewsState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserTrendingNewsState" ADD CONSTRAINT "UserTrendingNewsState_newsItemId_fkey" FOREIGN KEY ("newsItemId") REFERENCES "TrendingNewsItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
