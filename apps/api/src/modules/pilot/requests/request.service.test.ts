import type { JobStatus } from "@jobpilot/contracts/feed";
import type { PilotRequest, PrismaClient } from "@/generated/prisma/client";
import { RequestService } from "./request.service";
import { describe, expect, it } from "bun:test";

const FEED_ID = "0b6f3c2a-8d1e-4f5a-9c7b-3e2d1a0f9b8c";

interface FakeOptions {
  /** Rows the status move touches; 0 is a lost race. */
  moved?: number;
  /** The same work already waiting. */
  queued?: PilotRequest | null;
}

function service(status: JobStatus, options: FakeOptions = {}) {
  const jobWrites: { where: unknown; data: Record<string, unknown> }[] = [];
  const created: unknown[] = [];
  const db = {
    job: {
      findFirst: async () => ({ feedId: FEED_ID, key: "k1", status }),
      updateMany: async (a: (typeof jobWrites)[number]) => {
        jobWrites.push(a);
        return { count: options.moved ?? 1 };
      },
    },
    pilotRequest: {
      findFirst: async () => options.queued ?? null,
      create: async (a: { data: Record<string, unknown> }) => {
        created.push(a.data);
        return {
          status: "pending",
          runId: null,
          createdAt: new Date(),
          finishedAt: null,
          ...a.data,
        };
      },
    },
    pilotState: { updateMany: async () => ({ count: 1 }) },
    $transaction: async (work: (tx: unknown) => Promise<unknown>) => work(db),
  };
  const apply = () =>
    new RequestService(db as unknown as PrismaClient).create(
      "u1",
      { taskType: "job.apply", payload: { feedId: FEED_ID, jobKey: "k1" } },
      "chat",
    );
  return { apply, jobWrites, created };
}

describe("RequestService.create for job.apply", () => {
  it.each(["skipped", "failed", "queued", "needs_user"] as const)(
    "approves a %s job the user names, clearing the old outcome",
    async (status) => {
      const { apply, jobWrites } = service(status);
      await apply();
      expect(jobWrites).toEqual([
        {
          where: { feedId: FEED_ID, key: "k1", status },
          data: { status: "approved", appliedAt: null, failReason: null, skipReason: null },
        },
      ]);
    },
  );

  it("fails when the job moved before it could be approved", async () => {
    const { apply } = service("skipped", { moved: 0 });
    await expect(apply()).rejects.toMatchObject({ status: 409 });
  });

  it("refuses a job already applied to or being applied", async () => {
    for (const status of ["applied", "applying"] as const) {
      const { apply, jobWrites } = service(status);
      await expect(apply()).rejects.toMatchObject({ status: 409 });
      expect(jobWrites).toHaveLength(0);
    }
  });

  it("returns the queued request instead of queueing the same work twice", async () => {
    const queued: PilotRequest = {
      id: "r1",
      userId: "u1",
      taskType: "job.apply",
      payload: { feedId: FEED_ID, jobKey: "k1" },
      subjectType: "job",
      subjectId: `${FEED_ID}:k1`,
      status: "pending",
      source: "web",
      runId: null,
      createdAt: new Date(),
      finishedAt: null,
    };
    const { apply, created } = service("approved", { queued });
    expect(await apply()).toMatchObject({ id: "r1", status: "pending" });
    expect(created).toHaveLength(0);
  });
});
