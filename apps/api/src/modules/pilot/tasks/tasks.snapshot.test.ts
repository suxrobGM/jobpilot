import type { TaskList } from "@jobpilot/contracts/pilot";
import type { PrismaClient } from "@/generated/prisma/client";
import type { EmailSyncService } from "@/modules/email/sync/sync.service";
import type { JobService } from "@/modules/feed/jobs/job.service";
import type { WebPushService } from "@/modules/web-push/web-push.service";
import type { PilotJournalService } from "../thread/journal.service";
import { TaskListService } from "./task-list.service";
import { describe, expect, it } from "bun:test";

const now = new Date();
const snapshot: TaskList = {
  version: "fe0893aa-7310-4ea6-bbcf-ef803bd4b70b",
  builtAt: now,
  expiresAt: new Date(now.getTime() + 60_000),
  tasks: [],
  counts: { openQuestions: 0, activeRuns: 0, approvedJobs: 0, appliedToday: 0 },
  budget: {
    dailyApplyCap: 10,
    appliedToday: 0,
    capReached: false,
    dailyNetworkingCap: 5,
    networkingSentToday: 0,
    resetsAt: now,
  },
  emptyReason: "clear",
  sleepSeconds: 60,
  nextWakeAt: new Date(now.getTime() + 60_000),
};

function service(row: Record<string, unknown> | null) {
  let reads = 0;
  const prisma = {
    pilotState: {
      findUnique: async () => {
        reads += 1;
        return row;
      },
    },
  } as unknown as PrismaClient;
  return {
    taskList: new TaskListService(
      prisma,
      {} as JobService,
      {} as PilotJournalService,
      {} as WebPushService,
      {} as EmailSyncService,
    ),
    reads: () => reads,
  };
}

describe("TaskListService current snapshot", () => {
  it("returns the typed current snapshot with one read and no maintenance writes", async () => {
    const fixture = service({
      taskListSnapshot: snapshot,
      taskListExpiresAt: snapshot.expiresAt,
    });

    expect(await fixture.taskList.getCurrent("u1")).toEqual({ taskList: snapshot });
    expect(fixture.reads()).toBe(1);
  });

  it("returns no task list after the snapshot expires", async () => {
    const fixture = service({
      taskListSnapshot: snapshot,
      taskListExpiresAt: new Date(now.getTime() - 1),
    });

    expect(await fixture.taskList.getCurrent("u1")).toEqual({ taskList: null });
  });
});
