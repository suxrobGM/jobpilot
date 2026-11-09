import type { JobStatus } from "@jobpilot/contracts/feed";
import type { PrismaClient } from "@/generated/prisma/client";
import { RequestService } from "./request.service";
import { describe, expect, it } from "bun:test";

const FEED_ID = "0b6f3c2a-8d1e-4f5a-9c7b-3e2d1a0f9b8c";

function service(status: JobStatus, moved = 1) {
  const jobWrites: { where: unknown; data: Record<string, unknown> }[] = [];
  const db = {
    job: {
      findFirst: async () => ({ feedId: FEED_ID, key: "k1", status }),
      updateMany: async (a: (typeof jobWrites)[number]) => {
        jobWrites.push(a);
        return { count: moved };
      },
    },
    pilotRequest: {
      create: async (a: { data: Record<string, unknown> }) => ({
        status: "pending",
        runId: null,
        createdAt: new Date(),
        finishedAt: null,
        ...a.data,
      }),
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
  return { apply, jobWrites };
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
    const { apply } = service("skipped", 0);
    await expect(apply()).rejects.toMatchObject({ status: 409 });
  });

  it("refuses a job already applied to or being applied", async () => {
    for (const status of ["applied", "applying"] as const) {
      const { apply, jobWrites } = service(status);
      await expect(apply()).rejects.toMatchObject({ status: 409 });
      expect(jobWrites).toHaveLength(0);
    }
  });
});
