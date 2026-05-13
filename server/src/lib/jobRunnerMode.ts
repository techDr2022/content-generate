/**
 * When true, jobs are not consumed by a local BullMQ worker; Vercel Cron runs
 * `api/cron/run-worker` to process `pending` rows (see `executeGenerationJob`).
 * Still set DATABASE_URL, API keys, and optional REDIS for Bull Board / legacy dev.
 */
export function useCronDatabaseJobRunner(): boolean {
  return process.env.VERCEL === "1" || process.env.JOB_RUNNER === "cron";
}
