import type { PrismaClient } from "@/generated/prisma/client";
import type { EmailSyncService } from "@/modules/email/sync/sync.service";
import { JobAlertsService } from "./job-alerts.service";
import type { PilotService } from "./pilot.service";
import { describe, expect, it } from "bun:test";

interface JobQuery {
  where: { url: { in: string[] }; campaign: { userId: string } };
}

function seenService(storedUrls: string[]) {
  const queries: JobQuery[] = [];
  const db = {
    job: {
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
    expect(await svc.seenUrls("u1", sent)).toEqual({ seen: [sent[0]] });
    expect(queries[0].where).toMatchObject({
      url: { in: ["https://acme.com/jobs/1", "https://acme.com/jobs/2"] },
      campaign: { userId: "u1" },
    });
  });
});
