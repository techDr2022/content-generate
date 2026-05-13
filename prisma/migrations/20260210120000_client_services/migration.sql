-- AlterTable
ALTER TABLE "Client" ADD COLUMN "services" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
