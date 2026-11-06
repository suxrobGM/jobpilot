import { HOUR_MS } from "@/common/date/buckets";
import type { PrismaClient } from "@/generated/prisma/client";
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

function makeService(existing: Record<string, unknown> | null) {
  const rec = { updates: [] as Record<string, unknown>[], taskListResets: 0 };
  const db = {
    pilotSearch: {
      findFirst: async () => existing,
      update: async (a: { data: Record<string, unknown> }) => {
        rec.updates.push(a.data);
        return { id: "s1", ...existing, ...a.data };
      },
    },
    pilotState: {
      updateMany: async () => {
        rec.taskListResets++;
        return { count: 1 };
      },
    },
  };
  return { svc: new PilotSearchService(db as unknown as PrismaClient), rec };
}

describe("PilotSearchService.reportRun", () => {
  const report = { jobsScanned: 30, newJobs: 5, reachedEnd: false };

  it("404s an unknown search", async () => {
    const { svc } = makeService(null);
    await expect(svc.reportRun("p1", "missing", report)).rejects.toMatchObject({ status: 404 });
  });

  it("applies a run report to the schedule and clears the cached task list", async () => {
    const { svc, rec } = makeService({ id: "s1", emptyRuns: 0 });
    await svc.reportRun("p1", "s1", report);
    expect(rec.updates[0]).toMatchObject({ emptyRuns: 0, lastJobsScanned: 30, lastNewJobs: 5 });
    expect(rec.taskListResets).toBe(1);
  });
});
