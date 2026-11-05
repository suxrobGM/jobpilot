import type { PrismaClient } from "@/generated/prisma/client";
import { makePush } from "@/modules/web-push/web-push.fake";
import type { PushPayload } from "@/modules/web-push/web-push.service";
import { PilotJournalService } from "./journal.service";
import type { PilotService } from "./pilot.service";
import { describe, expect, it } from "bun:test";

type Row = Record<string, unknown>;

function makeService(rows: Row[] = [], pageSize = 2, runs: Row[] = []) {
  const rec = {
    creates: [] as Row[],
    stateUpserts: [] as { update: Row }[],
    pushes: [] as { userId: string; payload: PushPayload }[],
    wheres: [] as Row[],
    statePublishes: 0,
  };
  const db = {
    pilotJournalEntry: {
      createMany: async (a: { data: Row[] }) => {
        rec.creates.push(...a.data);
        return { count: a.data.length };
      },
      findMany: async (a: { where: Row; cursor?: { id: string } }) => {
        rec.wheres.push(a.where);
        const start = a.cursor ? rows.findIndex((row) => row.id === a.cursor?.id) + 1 : 0;
        return rows.slice(start, start + pageSize);
      },
    },
    pilotRun: { findMany: async () => runs },
    pilotState: {
      upsert: async (a: { update: Row }) => {
        rec.stateUpserts.push(a);
        return {};
      },
    },
    $transaction: async (work: (tx: unknown) => Promise<unknown>) => work(db),
  };
  const pilot = {
    publishCurrentState: async () => {
      rec.statePublishes++;
    },
  } as unknown as PilotService;
  const svc = new PilotJournalService(db as unknown as PrismaClient, makePush(rec.pushes), pilot);
  return { svc, rec };
}

describe("PilotJournalService.appendJournal", () => {
  it("advances cycle accounting only for cycle entries", async () => {
    const { svc, rec } = makeService();
    const res = await svc.appendJournal("p1", {
      runId: "run-1",
      entries: [
        { kind: "cycle", summary: "Completed cycle 1" },
        { kind: "action", summary: "Applied to job" },
      ],
    });
    expect(res.items).toHaveLength(2);
    expect(rec.stateUpserts).toHaveLength(1);
    expect(rec.statePublishes).toBe(1);
    expect(rec.stateUpserts[0].update).toMatchObject({
      cycleCount: { increment: 1 },
      lastCycleAt: expect.any(Date),
    });

    await svc.appendJournal("p1", { entries: [{ kind: "action", summary: "did a thing" }] });
    expect(rec.stateUpserts).toHaveLength(1);
    expect(rec.statePublishes).toBe(1);
  });

  it("plans the next wake from the cycle's sleep, and none for a cycle without one", async () => {
    const { svc, rec } = makeService();
    const before = Date.now();
    await svc.appendJournal("p1", {
      runId: "run-1",
      entries: [{ kind: "cycle", summary: "Task - done.", detail: { sleepSeconds: 60 } }],
    });
    await svc.appendJournal("p1", { entries: [{ kind: "cycle", summary: "Recovered." }] });
    const [planned, recovered] = rec.stateUpserts.map((upsert) => upsert.update.nextWakeAt);
    expect((planned as Date).getTime()).toBeGreaterThanOrEqual(before + 60_000);
    expect(recovered).toBeNull();
  });

  it("attaches the run each entry's cycle worked, with tokens only once usage is reported", async () => {
    const tokens = {
      inputTokens: 100,
      outputTokens: 20,
      cacheReadTokens: 300,
      cacheWriteTokens: 0,
    };
    const { svc } = makeService([], 2, [
      { id: "run-1", taskType: "job.apply", model: "claude-opus-5-5", ...tokens },
      { id: "run-2", taskType: "queue.score", model: null, ...tokens },
    ]);
    const res = await svc.appendJournal("p1", {
      runId: "run-1",
      entries: [{ kind: "action", summary: "Applied" }],
    });
    expect(res.items[0].run).toEqual({
      taskType: "job.apply",
      tokens: { input: 100, output: 20, cacheRead: 300, cacheWrite: 0 },
    });

    const pending = await svc.appendJournal("p1", {
      runId: "run-2",
      entries: [{ kind: "action", summary: "Scored" }],
    });
    expect(pending.items[0].run).toEqual({ taskType: "queue.score", tokens: null });
  });

  it("pushes an alert for a system entry only", async () => {
    const { svc, rec } = makeService();
    await svc.appendJournal("p1", {
      entries: [
        { kind: "action", summary: "applied to a job" },
        { kind: "system", summary: "Pilot stopped unexpectedly (orchestrator)" },
      ],
    });
    expect(rec.pushes).toEqual([
      {
        userId: "p1",
        payload: {
          title: "Pilot alert",
          body: "Pilot stopped unexpectedly (orchestrator)",
          url: "/pilot",
          tag: "pilot-system",
        },
      },
    ]);
  });
});

describe("PilotJournalService reads", () => {
  it("filters the list by kinds only when some are given", async () => {
    const { svc, rec } = makeService();
    await svc.listJournal("p1", undefined, 50, ["action", "cycle"]);
    await svc.listJournal("p1", undefined, 50, []);
    expect(rec.wheres).toEqual([
      { userId: "p1", kind: { in: ["action", "cycle"] } },
      { userId: "p1", kind: undefined },
    ]);
  });

  it("exports every entry as ordered NDJSON across batches", async () => {
    const entry = (id: string, minute: number) => ({
      id,
      userId: "p1",
      runId: null,
      kind: "action",
      summary: `entry ${id}`,
      detail: {},
      subjectType: null,
      subjectId: null,
      createdAt: new Date(Date.UTC(2026, 0, 1, 0, minute)),
    });
    const { svc } = makeService(["a", "b", "c", "d", "e"].map(entry));
    const res = svc.streamJournalExport("p1");
    expect(res.headers.get("content-type")).toBe("application/x-ndjson");

    const lines = (await res.text()).trim().split("\n");
    expect(lines.map((line) => JSON.parse(line).id)).toEqual(["a", "b", "c", "d", "e"]);
  });
});
