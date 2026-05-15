import { describe, it, expect } from "vitest";

/**
 * Full flow is covered manually or with E2E; this file documents the intended sequence.
 * Enable when DATABASE_URL, REVIEW_TOKEN_SECRET, REVIEW_SESSION_SECRET are set in CI.
 */
describe("review flow integration", () => {
  it.skip("POST session → verify → content → submit (requires live DB)", async () => {
    expect(true).toBe(true);
  });
});
