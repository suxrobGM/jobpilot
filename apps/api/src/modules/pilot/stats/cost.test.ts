import { costByKind } from "./cost";
import { describe, expect, it } from "bun:test";

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
