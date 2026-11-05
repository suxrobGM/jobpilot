import type { PrismaClient } from "@/generated/prisma/client";
import type { EmailSyncService } from "@/modules/email/sync/sync.service";
import { JobAlertsService } from "./job-alerts.service";
import type { PilotService } from "./pilot.service";
import { describe, expect, it } from "bun:test";

interface JobQuery {
  where: { url: { in: string[] }; userId: string };
}

function seenService(storedUrls: string[]) {
  const queries: JobQuery[] = [];
  const db = {
    campaignJob: {
      findMany: async (args: JobQuery) => {
        queries.push(args);
        return storedUrls.filter((url) => args.where.url.in.includes(url)).map((url) => ({ url }));
      },
    },
  };
  const svc = new JobAlertsService(
    db as unknown as PrismaClient,
    {} as EmailSyncService,
    {} as PilotService,
  );
  return { svc, queries };
}

describe("JobAlertsService.seenUrls", () => {
  it("returns the URLs as sent whose normalized form is already stored", async () => {
    const { svc, queries } = seenService(["https://acme.com/jobs/1"]);
    const sent = ["https://www.acme.com/jobs/1/?utm_source=alert", "https://acme.com/jobs/2"];
    expect(await svc.seenUrls("u1", sent, 7)).toEqual({ seen: [sent[0]] });
    expect(queries[0].where).toMatchObject({
      url: { in: ["https://acme.com/jobs/1", "https://acme.com/jobs/2"] },
      userId: "u1",
    });
  });
});

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
