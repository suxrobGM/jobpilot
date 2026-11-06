import type { PilotTask, TaskList } from "@jobpilot/contracts/pilot";
import { pilotChannel } from "@jobpilot/contracts/sse";
import { subscribe } from "@/common/sse/server";
import type { PilotJournalEntry, PrismaClient } from "@/generated/prisma/client";
import type { PilotJournalService } from "../thread/journal.service";
import { RunService } from "./run.service";
import { describe, expect, it } from "bun:test";

const USER_ID = "5f0d4d0e-4f27-4a0a-9f4e-2b1c6f1f7f01";
const RUN_ID = "4c965efd-b586-49ea-825b-1af715760116";
const VERSION = "31b0c512-b767-4dd7-9ee8-913e46d544c6";
const FEED_ID = "0b6f3c2a-8d1e-4f5a-9c7b-3e2d1a0f9b8c";
const PAUSED_FEED_ID = "7a1e9d4c-2b3f-4e6a-8d5c-9f0e1b2a3c4d";
const now = new Date();

const applyTask: PilotTask = {
  id: `job.apply:${FEED_ID}:j1`,
  taskType: "job.apply",
  priority: 100,
  title: "Engineer",
  subjectType: "job",
  subjectId: `${FEED_ID}:j1`,
  payload: {
    feedId: FEED_ID,
    jobKey: "j1",
    jobTitle: "Engineer",
    url: "https://example.test/job",
    board: null,
    brief: null,
    matchScore: 90,
  },
};

const pausedTask: PilotTask = {
  id: `search.review:${PAUSED_FEED_ID}`,
  taskType: "search.review",
  priority: 910,
  title: "Review a paused search: react",
  subjectType: "feed",
  subjectId: PAUSED_FEED_ID,
  payload: { feedId: PAUSED_FEED_ID, query: "react", board: null, pausedAt: now },
};

const snapshot: TaskList = {
  version: VERSION,
  builtAt: now,
  expiresAt: new Date(now.getTime() + 60_000),
  tasks: [applyTask, pausedTask],
  counts: { openQuestions: 0, activeRuns: 0, approvedJobs: 1, appliedToday: 0 },
  budget: {
    dailyApplyCap: 10,
    appliedToday: 0,
    capReached: false,
    dailyNetworkingCap: 5,
    networkingSentToday: 0,
    resetsAt: now,
  },
  emptyReason: null,
  sleepSeconds: 15,
  nextWakeAt: new Date(now.getTime() + 15_000),
};

function fakeJournal() {
  const appended: PilotJournalEntry[] = [];
  const journal = {
    publishAppended: async (_userId: string, rows: PilotJournalEntry[]) => appended.push(...rows),
  } as unknown as PilotJournalService;
  return { journal, appended };
}

function makeRunService(db: unknown, journal = fakeJournal().journal) {
  return new RunService(db as PrismaClient, journal);
}

interface RunSetup {
  currentVersion?: string;
  openRun?: { id: string } | null;
  feedStillPaused?: boolean;
}

function runDb({ currentVersion = VERSION, openRun = null, feedStillPaused = true }: RunSetup) {
  const creates: Record<string, unknown>[] = [];
  const db = {
    pilotState: {
      updateManyAndReturn: async (a: { where: { taskListVersion: string } }) =>
        a.where.taskListVersion === currentVersion ? [{ taskListSnapshot: snapshot }] : [],
    },
    pilotRequest: { updateManyAndReturn: async () => [] },
    pilotRun: {
      findFirst: async () => openRun,
      create: async (a: { data: Record<string, unknown> }) => {
        creates.push(a.data);
        return {
          id: RUN_ID,
          userId: USER_ID,
          startedAt: now,
          heartbeatAt: null,
          finishedAt: null,
          outcome: null,
          ...a.data,
        };
      },
    },
    feed: { count: async () => (feedStillPaused ? 1 : 0) },
    // What `startApplying` reads and writes; no duplicate matches.
    job: {
      findFirst: async () => ({
        url: "https://example.test/job",
        title: "Engineer",
        company: "Acme",
      }),
      findMany: async () => [],
      updateManyAndReturn: async () => [
        { feedId: FEED_ID, key: "j1", status: "applying", brief: null },
      ],
    },
    application: { findUnique: async () => null, findMany: async () => [] },
    $transaction: async (work: (tx: unknown) => Promise<unknown>) => work(db),
  };
  return { service: makeRunService(db), creates };
}

const runRow = (over: Record<string, unknown> = {}) => {
  const { taskType, subjectType, subjectId, payload } = applyTask;
  return {
    ...{ id: RUN_ID, userId: USER_ID, taskType, subjectType, subjectId, payload },
    ...{ startedAt: now, heartbeatAt: null, expiresAt: now, finishedAt: null, outcome: null },
    ...over,
  };
};

/** A fake for the close path: one owned row, updated in place. */
function closeDb(row: ReturnType<typeof runRow>) {
  const jobReverts: unknown[] = [];
  const requestWrites: { where: unknown; data: unknown }[] = [];
  const db = {
    pilotRun: {
      findFirst: async () => row,
      updateManyAndReturn: async (a: { data: Record<string, unknown> }) => [{ ...row, ...a.data }],
    },
    job: {
      updateMany: async (a: unknown) => {
        jobReverts.push(a);
        return { count: 1 };
      },
    },
    pilotJournalEntry: { createMany: async () => ({ count: 1 }) },
    pilotRequest: {
      updateManyAndReturn: async (a: { where: unknown; data: unknown }) => {
        requestWrites.push(a);
        return [];
      },
    },
    $transaction: async (work: (tx: unknown) => Promise<unknown>) => work(db),
  };
  return { db, jobReverts, requestWrites };
}

/** Runs `act` and returns its result with the pilot event it published. */
async function withEvent<T>(userId: string, act: () => Promise<T>): Promise<[T, unknown]> {
  const stream = subscribe(pilotChannel, { userId });
  await stream.next();
  const result = await act();
  const frame = (await stream.next()).value as unknown as { data: unknown };
  await stream.return();
  return [result, frame.data];
}

describe("RunService.start", () => {
  it("starts a task off the supplied snapshot and stores its payload", async () => {
    const { service, creates } = runDb({});
    const run = await service.start(USER_ID, VERSION, applyTask.id);
    expect(creates[0]).toMatchObject({ taskType: "job.apply", subjectId: `${FEED_ID}:j1` });
    expect(run.payload).toMatchObject({ feedId: FEED_ID, jobKey: "j1" });
  });

  it("publishes run.started", async () => {
    const [, event] = await withEvent(USER_ID, () =>
      runDb({}).service.start(USER_ID, VERSION, pausedTask.id),
    );
    expect(event).toEqual({
      type: "run.started",
      runId: RUN_ID,
      taskType: "search.review",
    });
  });

  it("refuses a stale snapshot, a held subject, or a row that changed since the build", async () => {
    const refusals: [RunSetup, string, string][] = [
      [{ currentVersion: "d6579e89-e9af-4f83-a04e-7d2cfad07cf3" }, applyTask.id, "stale"],
      [{ openRun: { id: "held" } }, applyTask.id, "already started"],
      [{ feedStillPaused: false }, pausedTask.id, "no longer paused"],
    ];
    for (const [setup, taskId, message] of refusals) {
      const { service, creates } = runDb(setup);
      await expect(service.start(USER_ID, VERSION, taskId)).rejects.toThrow(message);
      expect(creates).toHaveLength(0);
    }
  });
});

describe("RunService.heartbeat", () => {
  const heartbeat = async (startedMinutesAgo: number) => {
    const startedAt = new Date(Date.now() - startedMinutesAgo * 60_000);
    let expiresAt = new Date(0);
    const db = {
      pilotRun: {
        findFirst: async () => ({ startedAt, finishedAt: null }),
        updateManyAndReturn: async (a: { data: { expiresAt: Date } }) => {
          expiresAt = a.data.expiresAt;
          return [runRow({ startedAt, expiresAt })];
        },
      },
    };
    await makeRunService(db).heartbeat(USER_ID, RUN_ID);
    return (expiresAt.getTime() - Date.now()) / 60_000;
  };

  it("extends a young run by the full TTL", async () => {
    const minutesLeft = await heartbeat(1);
    expect(minutesLeft).toBeGreaterThan(14);
    expect(minutesLeft).toBeLessThanOrEqual(15);
  });

  it("holds a long-running run to its lifetime ceiling, even past it", async () => {
    const nearCeiling = await heartbeat(20);
    expect(nearCeiling).toBeGreaterThan(4);
    expect(nearCeiling).toBeLessThanOrEqual(5);
    expect(await heartbeat(90)).toBeLessThan(0);
  });
});

describe("RunService.cancel", () => {
  it("closes an open apply run, returns its job to approved, and publishes", async () => {
    const userId = crypto.randomUUID();
    const { db, jobReverts } = closeDb(runRow({ userId }));
    const [run, event] = await withEvent(userId, () => makeRunService(db).cancel(userId, RUN_ID));

    expect(run.outcome).toBe("cancelled");
    expect(jobReverts).toEqual([
      expect.objectContaining({
        where: expect.objectContaining({
          status: "applying",
          OR: [{ feedId: FEED_ID, key: "j1" }],
        }),
        data: { status: "approved" },
      }),
    ]);
    expect(event).toEqual({ type: "run.finished", runId: RUN_ID, outcome: "cancelled" });
  });

  it("returns a finished run unchanged", async () => {
    const { db, jobReverts } = closeDb(runRow({ finishedAt: now, outcome: "done" }));
    const run = await makeRunService(db).cancel(USER_ID, RUN_ID);
    expect(run.outcome).toBe("done");
    expect(jobReverts).toHaveLength(0);
  });
});

describe("RunService.recordResult", () => {
  const result = { outcome: "done" as const, summary: "Applied to Engineer at Acme" };

  const post = async (userId: string, finishedAt: Date | null) => {
    const { db, jobReverts } = closeDb(runRow({ userId, finishedAt }));
    const { journal, appended } = fakeJournal();
    const run = await makeRunService(db, journal).recordResult(userId, RUN_ID, result);
    return { run, appended, jobReverts };
  };

  it("journals the action under the run id, finishes the run, and publishes", async () => {
    const userId = crypto.randomUUID();
    const [{ run, appended, jobReverts }, event] = await withEvent(userId, () =>
      post(userId, null),
    );

    expect(run.outcome).toBe("done");
    expect(jobReverts).toHaveLength(0);
    expect(appended).toEqual([
      expect.objectContaining({
        runId: RUN_ID,
        kind: "action",
        summary: result.summary,
        subjectType: "job",
        subjectId: `${FEED_ID}:j1`,
      }),
    ]);
    expect(event).toEqual({ type: "run.finished", runId: RUN_ID, outcome: "done" });
  });

  it("returns a finished run unchanged and journals nothing", async () => {
    const { run, appended } = await post(USER_ID, now);
    expect(run.finishedAt).toEqual(now);
    expect(appended).toHaveLength(0);
  });
});

describe("a request follows the run that picked it up", () => {
  it.each([
    ["done", "done"],
    ["failed", "failed"],
  ] as const)("a %s result marks it %s", async (outcome, status) => {
    const { db, requestWrites } = closeDb(runRow());
    const { journal } = fakeJournal();
    await makeRunService(db, journal).recordResult(USER_ID, RUN_ID, { outcome, summary: "x" });
    expect(requestWrites).toEqual([
      {
        where: { runId: { in: [RUN_ID] }, status: "running" },
        data: expect.objectContaining({ status }),
      },
    ]);
  });

  it("a cancelled run cancels it", async () => {
    const { db, requestWrites } = closeDb(runRow());
    await makeRunService(db).cancel(USER_ID, RUN_ID);
    expect(requestWrites[0]?.data).toMatchObject({ status: "cancelled" });
  });
});
