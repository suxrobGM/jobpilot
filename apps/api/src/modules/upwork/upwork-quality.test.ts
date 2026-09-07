import type { UpworkClient } from "@jobpilot/contracts/upwork";
import { scoreUpworkClient } from "./upwork-quality";
import { describe, expect, it } from "bun:test";

/** A client that clears every hard rule, so a test can vary one signal at a time. */
const strong: UpworkClient = {
  paymentVerified: true,
  clientHires: 40,
  totalSpent: 50_000,
  rating: 4.9,
  reviewsCount: 40,
  proposalsCount: 2,
  postedHoursAgo: 3,
};

function score(overrides: Partial<UpworkClient> = {}) {
  return scoreUpworkClient({ ...strong, ...overrides });
}

describe("scoreUpworkClient hard-skip rules", () => {
  it("skips an unverified payment method before anything else", () => {
    const result = score({ paymentVerified: false });
    expect(result.verdict).toBe("skip");
    expect(result.skipReason).toBe("Unverified payment");
  });

  it("skips a saturated posting", () => {
    expect(score({ proposalsCount: 63 }).skipReason).toBe("Too many proposals - 63 already");
  });

  it("keeps a posting one proposal short of saturated", () => {
    expect(score({ proposalsCount: 49 }).skipReason).toBe(null);
  });

  it("does not hard-skip a client who has never hired, since spend and reviews may still vouch", () => {
    expect(score({ clientHires: 0 }).skipReason).toBe(null);
  });

  it("skips a client with observed zero spend, zero reviews and no verified payment", () => {
    expect(score({ paymentVerified: null, totalSpent: 0, reviewsCount: 0 }).skipReason).toBe(
      "Unproven & unverified client",
    );
  });

  it("does not treat unreadable spend and review counts as zeros", () => {
    expect(score({ paymentVerified: null, totalSpent: null, reviewsCount: null }).skipReason).toBe(
      null,
    );
  });

  it("skips on the soft floor when no hard rule fires", () => {
    const result = score({
      paymentVerified: null,
      clientHires: 0,
      totalSpent: 100,
      reviewsCount: 0,
      proposalsCount: 30,
      postedHoursAgo: 600,
    });
    expect(result.qualityScore).toBeLessThan(30);
    expect(result.skipReason).toBe(`Low client-quality score (${result.qualityScore})`);
  });
});

describe("scoreUpworkClient verdicts", () => {
  it("rates a strong client good", () => {
    const result = score();
    expect(result.verdict).toBe("good");
    expect(result.qualityScore).toBeGreaterThanOrEqual(65);
  });

  it("rates a middling client caution rather than skipping it", () => {
    const result = score({
      paymentVerified: null,
      clientHires: 1,
      totalSpent: 500,
      reviewsCount: 3,
      proposalsCount: 17,
      postedHoursAgo: 200,
    });
    expect(result.verdict).toBe("caution");
    expect(result.skipReason).toBe(null);
  });
});

describe("scoreUpworkClient with missing signals", () => {
  it("lands mid-range when every signal is absent", () => {
    const result = scoreUpworkClient({});
    expect(result.qualityScore).toBe(50);
    expect(result.verdict).toBe("caution");
    expect(result.flags).toEqual([]);
  });

  it("degrades each signal toward neutral independently", () => {
    const full = score().qualityScore;
    for (const key of [
      "paymentVerified",
      "clientHires",
      "totalSpent",
      "proposalsCount",
      "postedHoursAgo",
    ] as const) {
      expect(score({ [key]: null }).qualityScore).toBeLessThan(full);
    }
  });

  it("scores payment verification as the heaviest single signal", () => {
    expect(score().qualityScore - score({ paymentVerified: null }).qualityScore).toBe(15);
  });
});

describe("scoreUpworkClient flags", () => {
  it("reports only the signals it could read", () => {
    expect(scoreUpworkClient({ paymentVerified: true, clientHires: 12 }).flags).toEqual([
      "Payment verified",
      "12 hires",
    ]);
  });

  it("groups the rating into the review flag and formats spend", () => {
    expect(score({ totalSpent: 12_345, reviewsCount: 24, rating: 4.9 }).flags).toContain(
      "24 reviews (4.9★)",
    );
    expect(score({ totalSpent: 12_345 }).flags).toContain("$12,345 spent");
  });

  it("omits the rating when there is no rating to show", () => {
    expect(score({ reviewsCount: 7, rating: null }).flags).toContain("7 reviews");
  });
});
