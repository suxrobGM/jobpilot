import type { PrismaClient } from "@/generated/prisma/client";
import { makePush } from "@/modules/web-push/web-push.fake";
import type { PushPayload } from "@/modules/web-push/web-push.service";
import { PilotJournalService } from "./journal.service";
import { describe, expect, it } from "bun:test";

type Row = Record<string, unknown>;

function makeService(rows: Row[] = [], pageSize = 2, runs: Row[] = []) {
  const rec = {
    creates: [] as Row[],
    pushes: [] as { userId: string; payload: PushPayload }[],
  };
  const db = {
    pilotJournalEntry: {
      createMany: async (a: { data: Row[] }) => {
        rec.creates.push(...a.data);
        return { count: a.data.length };
      },
      findMany: async (a: { cursor?: { id: string } }) => {
        const start = a.cursor ? rows.findIndex((row) => row.id === a.cursor?.id) + 1 : 0;
        return rows.slice(start, start + pageSize);
      },
    },
    pilotRun: { findMany: async () => runs },
    $transaction: async (work: (tx: unknown) => Promise<unknown>) => work(db),
  };
  const svc = new PilotJournalService(db as unknown as PrismaClient, makePush(rec.pushes));
  return { svc, rec };
}

describe("PilotJournalService.appendJournal", () => {
  it("attaches each entry's run, with tokens only once usage is reported", async () => {
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
