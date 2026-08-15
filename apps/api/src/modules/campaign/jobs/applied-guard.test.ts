import { DAY_MS } from "@/common/date/buckets";
import type { DuplicateReader } from "@/modules/application/duplicate";
import { AlreadyAppliedError, assertNotAlreadyApplied } from "./applied-guard";
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

function reader(rows: FakeApplication[]): { db: DuplicateReader; queries: number } {
  const state = { queries: 0 };
  const db = {
    application: {
      findUnique: async ({ where }: { where: { userId_url: { url: string } } }) => {
        state.queries += 1;
        return rows.find((r) => r.url === where.userId_url.url) ?? null;
      },
      findMany: async ({ where }: { where: { appliedAt: { gte: Date } } }) => {
        state.queries += 1;
        return rows.filter((r) => r.appliedAt >= where.appliedAt.gte);
      },
    },
  };
  return {
    db: db as unknown as DuplicateReader,
    get queries() {
      return state.queries;
    },
  };
}

const EXISTING: FakeApplication = {
  id: "app-1",
  url: "https://example.test/jobs/1",
  title: "Frontend Engineer",
  company: "Acme",
  appliedAt: APPLIED_AT,
  status: "applied",
};

const JOB = { campaignId: "c1", key: "j1" };

describe("assertNotAlreadyApplied", () => {
  it("blocks the same posting by exact url", async () => {
    const { db } = reader([EXISTING]);

    await expect(
      assertNotAlreadyApplied(db, "u1", {
        ...JOB,
        url: EXISTING.url,
        title: "Frontend Engineer",
        company: "Acme",
      }),
    ).rejects.toThrow(/Already applied \(url\)/);
  });

  // The case the url constraint cannot catch: one posting reposted under a second link.
  it("blocks the same job listed at a different url", async () => {
    const { db } = reader([EXISTING]);

    await expect(
      assertNotAlreadyApplied(db, "u1", {
        ...JOB,
        url: "https://other-board.test/postings/999",
        title: "Senior Frontend Engineer",
        company: "Acme Inc",
      }),
    ).rejects.toThrow(/Already applied \(fuzzy\)/);
  });

  it("blocks a url that differs only by scheme, www and tracking params", async () => {
    const { db } = reader([EXISTING]);

    await expect(
      assertNotAlreadyApplied(db, "u1", {
        ...JOB,
        url: "http://www.example.test/jobs/1?utm_source=newsletter",
        title: "Frontend Engineer",
        company: "Acme",
      }),
    ).rejects.toThrow(/Already applied \(url\)/);
  });

  // Postings get reposted; without a cutoff the same url 409s forever, with no override.
  it("lets the same url through once it falls out of the window", async () => {
    const { db } = reader([
      { ...EXISTING, appliedAt: new Date(Date.now() - 200 * DAY_MS), title: "x", company: "y" },
    ]);

    await expect(
      assertNotAlreadyApplied(db, "u1", {
        ...JOB,
        url: EXISTING.url,
        title: "Frontend Engineer",
        company: "Acme",
      }),
    ).resolves.toBeUndefined();
  });

  it("names the clashing application and carries the job so the skip can be recorded", async () => {
    const { db } = reader([EXISTING]);
    const day = APPLIED_AT.toISOString().slice(0, 10);

    const error = await assertNotAlreadyApplied(db, "u1", {
      ...JOB,
      url: EXISTING.url,
      title: "x",
      company: "y",
    }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(AlreadyAppliedError);
    expect((error as AlreadyAppliedError).message).toMatch(
      new RegExp(`"Frontend Engineer" at Acme on ${day}`),
    );
    expect((error as AlreadyAppliedError).job).toEqual(JOB);
  });

  it("lets an unrelated job through", async () => {
    const { db } = reader([EXISTING]);

    await expect(
      assertNotAlreadyApplied(db, "u1", {
        ...JOB,
        url: "https://example.test/jobs/2",
        title: "Data Scientist",
        company: "Globex",
      }),
    ).resolves.toBeUndefined();
  });

  it("lets a different role at the same employer through", async () => {
    const { db } = reader([EXISTING]);

    await expect(
      assertNotAlreadyApplied(db, "u1", {
        ...JOB,
        url: "https://example.test/jobs/3",
        title: "Warehouse Associate",
        company: "Acme",
      }),
    ).resolves.toBeUndefined();
  });
});
