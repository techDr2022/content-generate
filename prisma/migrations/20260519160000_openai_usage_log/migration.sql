-- CreateTable
CREATE TABLE "OpenAiUsageLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "operation" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "size" TEXT,
    "quality" TEXT,
    "costUsd" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OpenAiUsageLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OpenAiUsageLog_createdAt_idx" ON "OpenAiUsageLog"("createdAt");

-- CreateIndex
CREATE INDEX "OpenAiUsageLog_userId_idx" ON "OpenAiUsageLog"("userId");

-- AddForeignKey
ALTER TABLE "OpenAiUsageLog" ADD CONSTRAINT "OpenAiUsageLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
