import { HOUR_MS } from "@/common/date/buckets";
import type { PrismaClient } from "@/generated/prisma/client";
import { makeBoards } from "@/modules/job-board/job-board.fake";
import { PilotSearchService, scheduleNextRun } from "./search.service";
import { describe, expect, it } from "bun:test";

const NOW = new Date("2026-07-15T12:00:00.000Z");

describe("scheduleNextRun", () => {
  const cases: [
    name: string,
    emptyRuns: number,
    newJobs: number,
    reachedEnd: boolean,
    gapHours: number,
    nextEmptyRuns: number,
  ][] = [
    ["a good run on a yielding board re-runs in 2h and clears the streak", 2, 5, false, 2, 0],
    ["a good run that reached the board's end waits 8h", 0, 5, true, 8, 0],
    ["a thin run waits 8h", 0, 1, false, 8, 0],
    ["a first dry run waits 8h", 0, 0, false, 8, 1],
    ["a second dry run waits 24h", 1, 0, false, 24, 2],
    ["a third dry run waits 48h", 2, 0, false, 48, 3],
    ["the dry streak holds at 48h", 7, 0, false, 48, 8],
  ];

  for (const [name, emptyRuns, newJobs, reachedEnd, gapHours, nextEmptyRuns] of cases) {
    it(name, () => {
      const next = scheduleNextRun(emptyRuns, { jobsScanned: 20, newJobs, reachedEnd }, NOW);
      expect((next.nextRunAt.getTime() - NOW.getTime()) / HOUR_MS).toBe(gapHours);
      expect(next.emptyRuns).toBe(nextEmptyRuns);
      expect(next).toMatchObject({ lastRunAt: NOW, lastJobsScanned: 20, lastNewJobs: newJobs });
    });
  }
});

interface SearchRows {
  existing?: Record<string, unknown> | null;
  clash?: { id: string } | null;
}

function makeService(over: SearchRows = {}) {
  const rec = {
    creates: [] as Record<string, unknown>[],
    updates: [] as Record<string, unknown>[],
    taskListResets: 0,
  };
  const db = {
    pilotSearch: {
      // A `query` in the where marks the uniqueness probe; otherwise it is the ownership load.
      findFirst: async (a: { where: { query?: string } }) =>
        a.where.query === undefined ? (over.existing ?? null) : (over.clash ?? null),
      create: async (a: { data: Record<string, unknown> }) => {
        rec.creates.push(a.data);
        return { id: "new", ...a.data };
      },
      update: async (a: { data: Record<string, unknown> }) => {
        rec.updates.push(a.data);
        return { id: "s1", ...over.existing, ...a.data };
      },
    },
    pilotState: {
      updateMany: async () => {
        rec.taskListResets++;
        return { count: 1 };
      },
    },
  };
  return { svc: new PilotSearchService(db as unknown as PrismaClient, makeBoards()), rec };
}

describe("PilotSearchService", () => {
  const existing = { id: "s1", query: "react", boardId: null, emptyRuns: 0 };

  it("creates a search and clears the cached task list", async () => {
    const { svc, rec } = makeService();
    await svc.create("p1", { query: "react", reason: "core stack" });
    expect(rec.creates[0]).toMatchObject({ userId: "p1", query: "react", boardId: null });
    expect(rec.taskListResets).toBe(1);
  });

  it("rejects a duplicate query and board, on create and on edit", async () => {
    const created = makeService({ clash: { id: "dupe" } });
    await expect(created.svc.create("p1", { query: "react", reason: "" })).rejects.toMatchObject({
      status: 409,
    });
    const edited = makeService({ existing, clash: { id: "dupe" } });
    await expect(edited.svc.update("p1", "s1", { query: "golang" })).rejects.toMatchObject({
      status: 409,
    });
  });

  it("restarts the schedule for a new query, but not for a new reason", async () => {
    const requeried = makeService({ existing });
    await requeried.svc.update("p1", "s1", { query: "golang" });
    expect(requeried.rec.updates[0]).toMatchObject({
      query: "golang",
      emptyRuns: 0,
      nextRunAt: expect.any(Date),
      lastJobsScanned: null,
      lastNewJobs: null,
    });

    const reworded = makeService({ existing });
    await reworded.svc.update("p1", "s1", { reason: "still my top pick" });
    expect(reworded.rec.updates[0]).toEqual({ reason: "still my top pick" });
  });

  it("404s an unknown search", async () => {
    const { svc } = makeService({ existing: null });
    await expect(svc.update("p1", "missing", { reason: "x" })).rejects.toMatchObject({
      status: 404,
    });
  });

  it("applies a run report to the schedule and clears the cached task list", async () => {
    const { svc, rec } = makeService({ existing });
    await svc.reportRun("p1", "s1", { jobsScanned: 30, newJobs: 5, reachedEnd: false });
    expect(rec.updates[0]).toMatchObject({ emptyRuns: 0, lastJobsScanned: 30, lastNewJobs: 5 });
    expect(rec.taskListResets).toBe(1);
  });
});
