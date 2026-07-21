// Fake-Prisma unit test for PilotJournalService: cycle accounting and the system-entry push.
// Injects a fake Prisma directly (no database); publish() is a no-op without subscribers.
import type { PushPayload } from "@/common/push";
import type { PrismaClient } from "@/generated/prisma/client";
import { makePush } from "./agenda/db.test-helpers";
import { PilotJournalService } from "./journal.service";
import { describe, expect, it } from "bun:test";

interface Recorder {
  journalCreates: Record<string, unknown>[];
  stateUpserts: { create: Record<string, unknown>; update: Record<string, unknown> }[];
  pushes: { userId: string; payload: PushPayload }[];
}

function makeDb() {
  const rec: Recorder = { journalCreates: [], stateUpserts: [], pushes: [] };
  const db = {
    pilotJournalEntry: {
      createMany: async (a: { data: Record<string, unknown>[] }) => {
        rec.journalCreates.push(...a.data);
        return { count: a.data.length };
      },
    },
    pilotState: {
      upsert: async (a: { create: Record<string, unknown>; update: Record<string, unknown> }) => {
        rec.stateUpserts.push(a);
        return {};
      },
    },
    $transaction: async (cb: (tx: unknown) => Promise<unknown>) => cb(db),
  };
  return { db, rec };
}

const service = () => {
  const { db, rec } = makeDb();
  return { svc: new PilotJournalService(db as unknown as PrismaClient, makePush(rec)), rec };
};

describe("PilotJournalService append", () => {
  it("advances cycle accounting when a cycle entry is written", async () => {
    const { svc, rec } = service();
    const res = await svc.appendJournal("p1", {
      cycleId: "cycle-1",
      entries: [
        { kind: "cycle", summary: "Completed cycle 1" },
        { kind: "action", summary: "Applied to job" },
      ],
    });

    expect(res.items).toHaveLength(2);
    expect(rec.journalCreates).toHaveLength(2);
    expect(rec.stateUpserts).toHaveLength(1);
    expect(rec.stateUpserts[0].update.cycleCount).toEqual({ increment: 1 });
    expect(rec.stateUpserts[0].update.lastCycleAt).toBeInstanceOf(Date);
  });

  it("does not touch cycle accounting without a cycle entry", async () => {
    const { svc, rec } = service();
    await svc.appendJournal("p1", { entries: [{ kind: "action", summary: "did a thing" }] });

    expect(rec.journalCreates).toHaveLength(1);
    expect(rec.stateUpserts).toHaveLength(0);
  });

  it("pushes an alert for a system entry but not for other kinds", async () => {
    const { svc, rec } = service();
    await svc.appendJournal("p1", {
      entries: [
        { kind: "action", summary: "applied to a job" },
        { kind: "system", summary: "Pilot stopped unexpectedly (orchestrator)" },
      ],
    });

    expect(rec.pushes).toHaveLength(1);
    expect(rec.pushes[0]).toMatchObject({
      userId: "p1",
      payload: {
        title: "Pilot alert",
        body: "Pilot stopped unexpectedly (orchestrator)",
        url: "/pilot",
        tag: "pilot-system",
      },
    });
  });
});
