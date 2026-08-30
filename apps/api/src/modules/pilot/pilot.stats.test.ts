import { readFileSync } from "node:fs";
import { join } from "node:path";
import { classifySkipReason, costByKind, type SkipBucket } from "./pilot.stats";
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
 * The classifier matches prose the agent is told to write, so a reworded doc must fail here rather
 * than quietly bucket every skip as `other`.
 */
describe("the phrasings eligibility.md prescribes", () => {
  const doc = readFileSync(
    join(import.meta.dir, "../../../../../plugin/skills/_shared/eligibility.md"),
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

describe("costByKind", () => {
  const NOW = new Date("2026-08-30T12:00:00Z");
  const at = (minutesAgo: number) => new Date(NOW.getTime() - minutesAgo * 60_000);

  const claims = (rows: Record<string, unknown>[]) =>
    ({ pilotClaim: { findMany: async () => rows } }) as unknown as Parameters<typeof costByKind>[0];

  it("ranks kinds by total time, not by how often they run", async () => {
    const rows = await costByKind(
      claims([
        { kind: "job.apply", grantedAt: at(30), releasedAt: at(20), outcome: "done" },
        { kind: "job.apply", grantedAt: at(60), releasedAt: at(40), outcome: "done" },
        // Runs three times as often but finishes in a minute, so it should rank below job.apply.
        { kind: "inbox.review", grantedAt: at(10), releasedAt: at(9), outcome: "done" },
        { kind: "inbox.review", grantedAt: at(12), releasedAt: at(11), outcome: "done" },
        { kind: "inbox.review", grantedAt: at(14), releasedAt: at(13), outcome: "done" },
      ]),
      "u1",
      NOW,
    );

    expect(rows.map((r) => r.kind)).toEqual(["job.apply", "inbox.review"]);
    expect(rows[0]).toMatchObject({ runs: 2, medianMs: 15 * 60_000, totalMs: 30 * 60_000 });
    expect(rows[1]).toMatchObject({ runs: 3, medianMs: 60_000 });
  });

  it("counts failed and abandoned claims separately", async () => {
    const rows = await costByKind(
      claims([
        { kind: "search.discover", grantedAt: at(30), releasedAt: at(25), outcome: "failed" },
        { kind: "search.discover", grantedAt: at(20), releasedAt: at(15), outcome: "expired" },
        { kind: "search.discover", grantedAt: at(10), releasedAt: at(5), outcome: "abandoned" },
        { kind: "search.discover", grantedAt: at(4), releasedAt: at(1), outcome: "done" },
      ]),
      "u1",
      NOW,
    );

    expect(rows[0]).toMatchObject({ runs: 4, failed: 1, abandoned: 2 });
  });

  it("ignores a claim still running, which has no duration yet", async () => {
    const rows = await costByKind(
      claims([{ kind: "job.apply", grantedAt: at(5), releasedAt: null, outcome: null }]),
      "u1",
      NOW,
    );

    expect(rows).toEqual([]);
  });
});
