import type { PrismaClient } from "@/generated/prisma/client";
import type { EmailSyncService } from "@/modules/email/sync/sync.service";
import { JobAlertsService } from "./job-alerts.service";
import type { PilotService } from "./pilot.service";
import { describe, expect, it } from "bun:test";

describe("JobAlertsService.runNow", () => {
  it("resumes a paused alerts campaign as the user", async () => {
    const resumes: Record<string, unknown>[] = [];
    const db = {
      emailMessage: { count: async () => 3 },
      pilotState: { findUnique: async () => null, upsert: async () => ({}) },
      campaign: {
        updateManyAndReturn: async (args: Record<string, unknown>) => {
          resumes.push(args);
          return [];
        },
      },
    };
    const svc = new JobAlertsService(
      db as unknown as PrismaClient,
      { syncIfStale: async () => {} } as unknown as EmailSyncService,
      { publishCurrentState: async () => {} } as unknown as PilotService,
    );
    expect(await svc.runNow("u1")).toEqual({ queued: true, pendingEmails: 3 });
    expect(resumes[0]).toMatchObject({
      where: { userId: "u1", feed: "job_alerts", status: "paused" },
      data: { status: "in_progress", statusChangedBy: "user" },
    });
  });
});
