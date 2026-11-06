import { conflict } from "@/common/errors";
import type { PrismaClient } from "@/generated/prisma/client";
import type { FeedService } from "@/modules/feed/feed.service";
import type { JobService } from "@/modules/feed/jobs/job.service";
import { PipelineService } from "./pipeline.service";
import { describe, expect, it } from "bun:test";

const prisma = {
  job: {
    findMany: async () => [
      { feedId: "f1", key: "ok" },
      { feedId: "f1", key: "taken" },
    ],
  },
} as unknown as PrismaClient;

const patched: string[] = [];
const jobs = {
  update: async (_userId: string, _feedId: string, key: string) => {
    if (key === "taken") throw conflict("Already applying");
    patched.push(key);
  },
} as unknown as JobService;

describe("PipelineService.bulk", () => {
  it("counts rows a transition refused, and ids the user doesn't own, as refused", async () => {
    const service = new PipelineService(prisma, {} as FeedService, jobs);
    const result = await service.bulk("u1", {
      action: "approve",
      ids: [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()],
    });
    expect(result).toEqual({ updated: 1, refused: 2 });
    expect(patched).toEqual(["ok"]);
  });
});
