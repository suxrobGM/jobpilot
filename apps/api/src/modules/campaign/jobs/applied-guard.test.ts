// The server-side half of duplicate protection. `/applied/check` is advice the agent can skip;
// this is the gate a second application actually has to get past, so it is tested on its own.
import type { DuplicateReader } from "@/modules/application/duplicate";
import { assertNotAlreadyApplied } from "./applied-guard";
import { describe, expect, it } from "bun:test";

const APPLIED_AT = new Date("2026-07-20T12:00:00.000Z");

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
      findMany: async () => {
        state.queries += 1;
        return rows;
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

describe("assertNotAlreadyApplied", () => {
  it("blocks the same posting by exact url", async () => {
    const { db } = reader([EXISTING]);

    await expect(
      assertNotAlreadyApplied(db, "u1", {
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
        url: "https://other-board.test/postings/999",
        title: "Senior Frontend Engineer",
        company: "Acme Inc",
      }),
    ).rejects.toThrow(/Already applied \(fuzzy\)/);
  });

  it("names the clashing application so the skip reason can be written from the error", async () => {
    const { db } = reader([EXISTING]);

    await expect(
      assertNotAlreadyApplied(db, "u1", { url: EXISTING.url, title: "x", company: "y" }),
    ).rejects.toThrow(/"Frontend Engineer" at Acme on 2026-07-20/);
  });

  it("lets an unrelated job through", async () => {
    const { db } = reader([EXISTING]);

    await expect(
      assertNotAlreadyApplied(db, "u1", {
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
        url: "https://example.test/jobs/3",
        title: "Warehouse Associate",
        company: "Acme",
      }),
    ).resolves.toBeUndefined();
  });
});
