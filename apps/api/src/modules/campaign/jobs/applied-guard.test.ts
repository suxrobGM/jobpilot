// `/applied/check` is advice the agent can skip; this is the gate a second application has to get
// past, so it is tested on its own.
import { DAY_MS } from "@/common/date/buckets";
import { AlreadyAppliedError, type GuardTransaction, skipIfAlreadyApplied } from "./applied-guard";
import { describe, expect, it } from "bun:test";

/** Relative to now, so the fixture stays inside the window as the calendar moves. */
const APPLIED_AT = new Date(Date.now() - 5 * DAY_MS);

interface FakeApplication {
  id: string;
  url: string;
  title: string;
  company: string;
  appliedAt: Date;
  status: string;
}

interface Written {
  where: Record<string, unknown>;
  data: Record<string, unknown>;
}

function transaction(rows: FakeApplication[]): { tx: GuardTransaction; writes: Written[] } {
  const writes: Written[] = [];
  const tx = {
    application: {
      findUnique: async ({ where }: { where: { userId_url: { url: string } } }) =>
        rows.find((r) => r.url === where.userId_url.url) ?? null,
      findMany: async ({ where }: { where: { appliedAt: { gte: Date } } }) =>
        rows.filter((r) => r.appliedAt >= where.appliedAt.gte),
    },
    job: {
      updateManyAndReturn: async (args: Written) => {
        writes.push(args);
        return [{ key: args.where.key, status: "skipped", ...args.data }];
      },
      groupBy: async () => [{ campaignId: "c1", status: "skipped", _count: { _all: 1 } }],
    },
  };
  return { tx: tx as unknown as GuardTransaction, writes };
}

const EXISTING: FakeApplication = {
  id: "app-1",
  url: "https://example.test/jobs/1",
  title: "Frontend Engineer",
  company: "Acme",
  appliedAt: APPLIED_AT,
  status: "applied",
};

const JOB = { campaignId: "c1", key: "j1", campaign: { source: "auto_apply" as const } };

describe("skipIfAlreadyApplied", () => {
  it("blocks the same posting by exact url", async () => {
    const { tx } = transaction([EXISTING]);

    const refusal = await skipIfAlreadyApplied(tx, "u1", {
      ...JOB,
      url: EXISTING.url,
      title: "Frontend Engineer",
      company: "Acme",
    });

    expect(refusal?.message).toMatch(/Already applied \(url\)/);
  });

  // The case the url constraint cannot catch: one posting reposted under a second link.
  it("blocks the same job listed at a different url", async () => {
    const { tx } = transaction([EXISTING]);

    const refusal = await skipIfAlreadyApplied(tx, "u1", {
      ...JOB,
      url: "https://other-board.test/postings/999",
      title: "Senior Frontend Engineer",
      company: "Acme Inc",
    });

    expect(refusal?.message).toMatch(/Already applied \(fuzzy\)/);
  });

  it("blocks a url that differs only by scheme, www and tracking params", async () => {
    const { tx } = transaction([EXISTING]);

    const refusal = await skipIfAlreadyApplied(tx, "u1", {
      ...JOB,
      url: "http://www.example.test/jobs/1?utm_source=newsletter",
      title: "Frontend Engineer",
      company: "Acme",
    });

    expect(refusal?.message).toMatch(/Already applied \(url\)/);
  });

  // Postings get reposted; without a cutoff the same url 409s forever, with no override.
  it("lets the same url through once it falls out of the window", async () => {
    const { tx, writes } = transaction([
      { ...EXISTING, appliedAt: new Date(Date.now() - 200 * DAY_MS), title: "x", company: "y" },
    ]);

    const refusal = await skipIfAlreadyApplied(tx, "u1", {
      ...JOB,
      url: EXISTING.url,
      title: "Frontend Engineer",
      company: "Acme",
    });

    expect(refusal).toBeNull();
    expect(writes).toHaveLength(0);
  });

  // The skip commits with the caller's transaction, so the job cannot be left `approved`.
  it("records the job skipped with the duplicate reason before refusing", async () => {
    const { tx, writes } = transaction([EXISTING]);

    const refusal = await skipIfAlreadyApplied(tx, "u1", {
      ...JOB,
      url: EXISTING.url,
      title: "x",
      company: "y",
    });

    expect(writes).toHaveLength(1);
    expect(writes[0]).toMatchObject({
      where: { campaignId: "c1", key: "j1" },
      data: { status: "skipped", skipReason: "Already applied (url)" },
    });
    expect(refusal?.skipped).toMatchObject({ job: { status: "skipped" } });
  });

  it("names the clashing application and carries the summary the skip moved", async () => {
    const { tx } = transaction([EXISTING]);
    const day = APPLIED_AT.toISOString().slice(0, 10);

    const refusal = await skipIfAlreadyApplied(tx, "u1", {
      ...JOB,
      url: EXISTING.url,
      title: "x",
      company: "y",
    });

    expect(refusal).toBeInstanceOf(AlreadyAppliedError);
    expect(refusal?.message).toMatch(new RegExp(`"Frontend Engineer" at Acme on ${day}`));
    expect(refusal?.message).toMatch(/recorded as skipped/);
    expect(refusal?.skipped?.summary).toMatchObject({ kind: "jobs", skipped: 1 });
  });

  it("lets an unrelated job through", async () => {
    const { tx } = transaction([EXISTING]);

    const refusal = await skipIfAlreadyApplied(tx, "u1", {
      ...JOB,
      url: "https://example.test/jobs/2",
      title: "Data Scientist",
      company: "Globex",
    });

    expect(refusal).toBeNull();
  });

  it("lets a different role at the same employer through", async () => {
    const { tx } = transaction([EXISTING]);

    const refusal = await skipIfAlreadyApplied(tx, "u1", {
      ...JOB,
      url: "https://example.test/jobs/3",
      title: "Warehouse Associate",
      company: "Acme",
    });

    expect(refusal).toBeNull();
  });
});
