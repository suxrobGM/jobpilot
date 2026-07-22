import type { AgendaResponse } from "@jobpilot/contracts/pilot";
import type { PushService } from "@/common/push";
import type { PrismaClient } from "@/generated/prisma/client";
import type { CampaignJobService } from "@/modules/campaign/jobs/job.service";
import type { PilotJournalService } from "../journal.service";
import { AgendaService } from "./service";
import { describe, expect, it } from "bun:test";

const now = new Date();
const snapshot: AgendaResponse = {
  version: "fe0893aa-7310-4ea6-bbcf-ef803bd4b70b",
  generatedAt: now,
  expiresAt: new Date(now.getTime() + 60_000),
  items: [],
  counts: { openQuestions: 0, activeClaims: 0, approvedJobs: 0, appliedToday: 0 },
  budget: { dailyApplyCap: 10, appliedToday: 0, capReached: false, resetsAt: now },
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
    agenda: new AgendaService(
      prisma,
      {} as CampaignJobService,
      {} as PilotJournalService,
      {} as PushService,
    ),
    reads: () => reads,
  };
}

describe("AgendaService current snapshot", () => {
  it("returns the typed current snapshot with one read and no maintenance writes", async () => {
    const fixture = service({
      running: true,
      agendaSnapshot: snapshot,
      agendaExpiresAt: snapshot.expiresAt,
    });

    expect(await fixture.agenda.getCurrent("u1")).toEqual({ agenda: snapshot });
    expect(fixture.reads()).toBe(1);
  });

  it("returns no agenda after the snapshot expires", async () => {
    const fixture = service({
      running: true,
      agendaSnapshot: snapshot,
      agendaExpiresAt: new Date(now.getTime() - 1),
    });

    expect(await fixture.agenda.getCurrent("u1")).toEqual({ agenda: null });
  });

  it("rejects reads while the pilot is stopped", async () => {
    const fixture = service({ running: false });
    await expect(fixture.agenda.getCurrent("u1")).rejects.toThrow("stopped");
  });
});
