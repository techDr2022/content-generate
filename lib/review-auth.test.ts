import { describe, it, expect, beforeEach } from "vitest";
import {
  generatePin,
  generateReviewToken,
  hashPin,
  signReviewSessionCookie,
  verifyPin,
  verifyReviewSessionToken,
  verifyReviewToken,
} from "./review-auth";

describe("review-auth", () => {
  beforeEach(() => {
    process.env.REVIEW_TOKEN_SECRET = "t".repeat(32);
    process.env.REVIEW_SESSION_SECRET = "s".repeat(32);
  });

  it("round-trips review link JWT", () => {
    const token = generateReviewToken(
      { sessionId: "sess_1", calendarId: "cal_1", clientId: "cli_1" },
      1
    );
    const payload = verifyReviewToken(token);
    expect(payload).toEqual({ sessionId: "sess_1", calendarId: "cal_1", clientId: "cli_1" });
  });

  it("round-trips review session cookie JWT", () => {
    const t = signReviewSessionCookie("sess_1");
    expect(verifyReviewSessionToken(t)).toEqual({ sessionId: "sess_1" });
  });

  it("hashes and verifies PIN", async () => {
    const pin = generatePin();
    expect(pin).toMatch(/^\d{6}$/);
    const h = await hashPin(pin);
    expect(await verifyPin(pin, h)).toBe(true);
    expect(await verifyPin("000000", h)).toBe(false);
  });
});
