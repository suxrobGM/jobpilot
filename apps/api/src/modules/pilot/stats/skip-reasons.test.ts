import { readFileSync } from "node:fs";
import { join } from "node:path";
import { classifySkipReason, SERVER_SKIP_REASONS, type SkipBucket } from "./skip-reasons";
import { describe, expect, it } from "bun:test";

describe("classifySkipReason", () => {
  const cases: [string, SkipBucket][] = [
    ["US citizenship required", "citizenship"],
    ["Active security clearance required", "clearance"],
    ['No visa sponsorship (JD: "we are not able to provide visa sponsorship")', "sponsorship"],
    ["Already applied (url)", "alreadyApplied"],
    ["Already applied (fuzzy)", "alreadyApplied"],
    ["CAPTCHA - apply manually via the apply skill", "captcha"],
    ["Payment required", "payment"],
    ["Below minimum match score (52 < 60)", "belowMinScore"],
    ["Posting is no longer accepting applications", "postingClosed"],
    ["Recruiter asked for a portfolio we don't have", "other"],
  ];

  for (const [reason, bucket] of cases) {
    it(`buckets "${reason}" as ${bucket}`, () => {
      expect(classifySkipReason(reason)).toBe(bucket);
    });
  }

  it("is case-insensitive", () => {
    expect(classifySkipReason("us CITIZENSHIP required")).toBe("citizenship");
  });

  // Same precedence as the scoring detector: a reason naming both is the sponsorship problem.
  it("reports sponsorship when a reason names both bars", () => {
    expect(classifySkipReason("US citizenship required, no sponsorship offered")).toBe(
      "sponsorship",
    );
  });
});

/**
 * The server writes these itself, so a reworded literal at the call site must fail here rather than
 * silently demote that skip to `other`.
 */
describe("the skips the server writes", () => {
  const serverCases = Object.entries(SERVER_SKIP_REASONS) as [SkipBucket, string][];

  for (const [bucket, reason] of serverCases) {
    it(`buckets "${reason}" as ${bucket}`, () => {
      expect(classifySkipReason(reason)).toBe(bucket);
    });
  }

  // The prose heuristics read "expired" as a closed posting, which this reason is not.
  it("does not read an expired question as a closed posting", () => {
    expect(classifySkipReason(SERVER_SKIP_REASONS.unanswered)).not.toBe("postingClosed");
  });
});

/**
 * The classifier matches prose the agent is told to write, so a reworded doc must fail here rather
 * than quietly bucket every skip as `other`.
 */
describe("the phrasings eligibility.md prescribes", () => {
  const doc = readFileSync(
    join(import.meta.dir, "../../../../../../plugin/skills/_shared/eligibility.md"),
    "utf8",
  ).toLowerCase();

  const prescribed: [phrase: string, reason: string, bucket: SkipBucket][] = [
    ["already applied (", "Already applied (url)", "alreadyApplied"],
    ["below minimum match score (", "Below minimum match score (52 < 60)", "belowMinScore"],
    [
      "captcha - apply manually via the apply skill",
      "CAPTCHA - apply manually via the apply skill",
      "captcha",
    ],
    ["payment required", "Payment required", "payment"],
    ["us citizenship required", "US citizenship required", "citizenship"],
    ["active security clearance required", "Active security clearance required", "clearance"],
    [
      'no visa sponsorship (jd: "',
      'No visa sponsorship (JD: "we cannot sponsor visas")',
      "sponsorship",
    ],
  ];

  for (const [phrase, reason, bucket] of prescribed) {
    it(`still asks for "${phrase}" and buckets it as ${bucket}`, () => {
      expect(doc).toContain(phrase);
      expect(classifySkipReason(reason)).toBe(bucket);
    });
  }
});
