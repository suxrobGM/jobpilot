// Fake-Prisma unit test for PilotSearchService and its pure scheduleNextRun policy (no database).
import { HOUR_MS } from "@/common/date/buckets";
import type { PrismaClient } from "@/generated/prisma/client";
import { PilotSearchService, scheduleNextRun } from "./pilot-search.service";
import { describe, expect, it } from "bun:test";

const NOW = new Date("2026-07-15T12:00:00.000Z");

describe("scheduleNextRun", () => {
  const run = (over: Partial<Parameters<typeof scheduleNextRun>[0]> = {}) =>
    scheduleNextRun({
      emptyRuns: 0,
      jobsSeen: 20,
      newJobs: 0,
      reachedEnd: false,
      now: NOW,
      ...over,
    });
  const gapHours = (r: { nextRunAt: Date }) => (r.nextRunAt.getTime() - NOW.getTime()) / HOUR_MS;

  const cases: {
    name: string;
    input: Partial<Parameters<typeof scheduleNextRun>[0]>;
    gapHours: number;
    emptyRuns: number;
  }[] = [
    {
      name: "good run, still yielding → 2h",
      input: { newJobs: 5, reachedEnd: false, emptyRuns: 2 },
      gapHours: 2,
      emptyRuns: 0,
    },
    {
      name: "good run that hit the board end → 8h",
      input: { newJobs: 5, reachedEnd: true },
      gapHours: 8,
      emptyRuns: 0,
    },
    { name: "thin run (1) → 8h", input: { newJobs: 1 }, gapHours: 8, emptyRuns: 0 },
    {
      name: "thin run (2) → 8h",
      input: { newJobs: 2, reachedEnd: true },
      gapHours: 8,
      emptyRuns: 0,
    },
    {
      name: "dry ladder rung 1 → 8h",
      input: { newJobs: 0, emptyRuns: 0 },
      gapHours: 8,
      emptyRuns: 1,
    },
    {
      name: "dry ladder rung 2 → 24h",
      input: { newJobs: 0, emptyRuns: 1 },
      gapHours: 24,
      emptyRuns: 2,
    },
    {
      name: "dry ladder rung 3 → 48h",
      input: { newJobs: 0, emptyRuns: 2 },
      gapHours: 48,
      emptyRuns: 3,
    },
    {
      name: "dry ladder holds at 48h past the cap",
      input: { newJobs: 0, emptyRuns: 7 },
      gapHours: 48,
      emptyRuns: 8,
    },
  ];

  for (const c of cases) {
    it(c.name, () => {
      const r = run(c.input);
      expect(gapHours(r)).toBe(c.gapHours);
      expect(r.emptyRuns).toBe(c.emptyRuns);
    });
  }

  it("always records lastRunAt/lastJobsSeen/lastNewJobs from the run", () => {
    const r = run({ jobsSeen: 42, newJobs: 3 });
    expect(r).toMatchObject({ lastRunAt: NOW, lastJobsSeen: 42, lastNewJobs: 3 });
  });

  it("resets the backoff on a good run after a dry streak", () => {
    expect(run({ newJobs: 4, emptyRuns: 3 }).emptyRuns).toBe(0);
  });
});

interface DbOver {
  existing?: Record<string, unknown> | null;
  clash?: { id: string } | null;
}

function makeDb(over: DbOver = {}) {
  const rec = {
    creates: [] as Record<string, unknown>[],
    updates: [] as { where: Record<string, unknown>; data: Record<string, unknown> }[],
    deletes: [] as Record<string, unknown>[],
    stateUpdates: [] as { data: Record<string, unknown> }[],
  };
  const db = {
    pilotSearch: {
      // A `query` in the where marks the uniqueness probe; otherwise it's the findOwned load.
      findFirst: async (a: { where: { query?: string } }) =>
        a.where.query !== undefined ? (over.clash ?? null) : (over.existing ?? null),
      create: async (a: { data: Record<string, unknown> }) => {
        rec.creates.push(a.data);
        return { id: "new", ...a.data };
      },
      update: async (a: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        rec.updates.push(a);
        return { id: "s1", ...over.existing, ...a.data };
      },
      delete: async (a: { where: Record<string, unknown> }) => {
        rec.deletes.push(a.where);
        return {};
      },
    },
    pilotState: {
      updateMany: async (a: { data: Record<string, unknown> }) => {
        rec.stateUpdates.push(a);
        return { count: 1 };
      },
    },
  };
  return { svc: new PilotSearchService(db as unknown as PrismaClient), rec };
}

describe("PilotSearchService.create", () => {
  it("creates a search and nulls the agenda snapshot", async () => {
    const { svc, rec } = makeDb();
    await svc.create("p1", { query: "react", reason: "core stack" });
    expect(rec.creates[0]).toMatchObject({
      userId: "p1",
      query: "react",
      board: null,
      reason: "core stack",
    });
    expect(rec.stateUpdates[0].data.agendaSnapshot).toBeDefined();
  });

  it("rejects a duplicate query+board with 409", async () => {
    const { svc } = makeDb({ clash: { id: "dupe" } });
    await expect(svc.create("p1", { query: "react", reason: "" })).rejects.toMatchObject({
      status: 409,
    });
  });
});

describe("PilotSearchService.update", () => {
  it("restarts scheduling when the query changes", async () => {
    const { svc, rec } = makeDb({ existing: { id: "s1", query: "react", board: null } });
    await svc.update("p1", "s1", { query: "golang" });
    expect(rec.updates[0].data).toMatchObject({
      query: "golang",
      emptyRuns: 0,
      lastJobsSeen: null,
      lastNewJobs: null,
    });
    expect(rec.updates[0].data.nextRunAt).toBeInstanceOf(Date);
  });

  it("leaves scheduling untouched when only the reason changes", async () => {
    const { svc, rec } = makeDb({ existing: { id: "s1", query: "react", board: null } });
    await svc.update("p1", "s1", { reason: "still my top pick" });
    expect(rec.updates[0].data).toEqual({ reason: "still my top pick" });
  });

  it("404s an unknown search", async () => {
    const { svc } = makeDb({ existing: null });
    await expect(svc.update("p1", "missing", { reason: "x" })).rejects.toMatchObject({
      status: 404,
    });
  });
});

describe("PilotSearchService.reportRun", () => {
  it("applies scheduleNextRun and nulls the agenda snapshot", async () => {
    const { svc, rec } = makeDb({ existing: { emptyRuns: 0 } });
    await svc.reportRun("p1", "s1", { jobsSeen: 30, newJobs: 5, reachedEnd: false });
    // 5 new jobs, board still yielding ⇒ good-run 2h re-run, backoff cleared.
    expect(rec.updates[0].data).toMatchObject({ emptyRuns: 0, lastJobsSeen: 30, lastNewJobs: 5 });
    expect(rec.stateUpdates[0].data.agendaSnapshot).toBeDefined();
  });
});
