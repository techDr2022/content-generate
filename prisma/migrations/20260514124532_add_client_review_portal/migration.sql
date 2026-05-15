-- CreateEnum
CREATE TYPE "ReviewSessionStatus" AS ENUM ('PENDING', 'OPENED', 'IN_REVIEW', 'SUBMITTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "PostFeedbackStatus" AS ENUM ('PENDING', 'APPROVED', 'APPROVED_WITH_EDITS', 'REJECTED');

-- CreateTable
CREATE TABLE "Calendar" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Calendar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Post" (
    "id" TEXT NOT NULL,
    "calendarId" TEXT NOT NULL,
    "rowIndex" INTEGER NOT NULL,
    "date" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "postType" TEXT NOT NULL,
    "style" TEXT NOT NULL,
    "textInImage" TEXT NOT NULL DEFAULT '',
    "caption" TEXT NOT NULL,
    "hashtags" TEXT NOT NULL DEFAULT '',
    "specialDay" TEXT,
    "topic" TEXT NOT NULL DEFAULT '',
    "isAIAdded" BOOLEAN NOT NULL DEFAULT false,
    "posterObjectKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Post_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientReviewSession" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "calendarId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "pin" TEXT,
    "email" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastAccessedAt" TIMESTAMP(3),
    "status" "ReviewSessionStatus" NOT NULL DEFAULT 'PENDING',
    "submittedAt" TIMESTAMP(3),
    "internalNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientReviewSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostFeedback" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "status" "PostFeedbackStatus" NOT NULL DEFAULT 'PENDING',
    "editedCaption" TEXT,
    "editedHashtags" TEXT,
    "rejectionReason" TEXT,
    "clientNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PostFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewSessionLog" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "postId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewSessionLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Calendar_clientId_idx" ON "Calendar"("clientId");

-- CreateIndex
CREATE INDEX "Post_calendarId_idx" ON "Post"("calendarId");

-- CreateIndex
CREATE UNIQUE INDEX "Post_calendarId_rowIndex_key" ON "Post"("calendarId", "rowIndex");

-- CreateIndex
CREATE UNIQUE INDEX "ClientReviewSession_accessToken_key" ON "ClientReviewSession"("accessToken");

-- CreateIndex
CREATE INDEX "ClientReviewSession_clientId_calendarId_idx" ON "ClientReviewSession"("clientId", "calendarId");

-- CreateIndex
CREATE INDEX "ClientReviewSession_accessToken_idx" ON "ClientReviewSession"("accessToken");

-- CreateIndex
CREATE UNIQUE INDEX "PostFeedback_sessionId_postId_key" ON "PostFeedback"("sessionId", "postId");

-- CreateIndex
CREATE INDEX "ReviewSessionLog_sessionId_idx" ON "ReviewSessionLog"("sessionId");

-- AddForeignKey
ALTER TABLE "Calendar" ADD CONSTRAINT "Calendar_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Calendar" ADD CONSTRAINT "Calendar_id_fkey" FOREIGN KEY ("id") REFERENCES "GenerationJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_calendarId_fkey" FOREIGN KEY ("calendarId") REFERENCES "Calendar"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientReviewSession" ADD CONSTRAINT "ClientReviewSession_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientReviewSession" ADD CONSTRAINT "ClientReviewSession_calendarId_fkey" FOREIGN KEY ("calendarId") REFERENCES "Calendar"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientReviewSession" ADD CONSTRAINT "ClientReviewSession_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostFeedback" ADD CONSTRAINT "PostFeedback_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ClientReviewSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostFeedback" ADD CONSTRAINT "PostFeedback_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewSessionLog" ADD CONSTRAINT "ReviewSessionLog_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ClientReviewSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewSessionLog" ADD CONSTRAINT "ReviewSessionLog_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE SET NULL ON UPDATE CASCADE;
