-- Carousels-for-month profile (subset of postsPerMonth); drives generator defaults.
ALTER TABLE "Client" ADD COLUMN "carouselsPerMonth" INTEGER NOT NULL DEFAULT 0;
