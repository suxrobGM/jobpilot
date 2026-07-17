// Fake-Prisma unit test for PilotService: question lifecycle and journal cycle accounting.
// Injects a fake Prisma directly (no database); publish() is a no-op without subscribers.
import type { PushPayload } from "@/common/push";
import type { PrismaClient } from "@/generated/prisma/client";
import { makePush } from "./agenda/db.test-helpers";
import { PilotService } from "./pilot.service";
import { describe, expect, it } from "bun:test";

interface Recorder {
  questionCreate?: Record<string, unknown>;
  questionUpdate?: { data: Record<string, unknown> };
  journalCreates: Record<string, unknown>[];
  stateUpserts: { create: Record<string, unknown>; update: Record<string, unknown> }[];
  pushes: { profileId: string; payload: PushPayload }[];
}

function makeDb(questionOver: Record<string, unknown> = {}) {
  const rec: Recorder = { journalCreates: [], stateUpserts: [], pushes: [] };
  // A single mutable question row so the status guard in updateMany is observable.
  const question: Record<string, unknown> = {
    id: "e1",
    profileId: "p1",
    kind: "question",
    status: "open",
    subjectType: null,
    subjectId: null,
    prompt: "q",
    options: "[]",
    deepLink: null,
    answer: null,
    answeredAt: null,
    expiresAt: null,
    createdAt: new Date(),
    ...questionOver,
  };
  const db = {
    question: {
      create: async (a: { data: Record<string, unknown> }) => {
        rec.questionCreate = a.data;
        return { ...question, ...a.data };
      },
      findFirst: async () => ({ ...question }),
      updateMany: async (a: { where: { status?: string }; data: Record<string, unknown> }) => {
        if (a.where.status && question.status !== a.where.status) return { count: 0 };
        rec.questionUpdate = { data: a.data };
        Object.assign(question, a.data);
        return { count: 1 };
      },
    },
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
  return { db, rec, question };
}

const service = (questionOver: Record<string, unknown> = {}) => {
  const { db, rec, question } = makeDb(questionOver);
  return { svc: new PilotService(db as unknown as PrismaClient, makePush(rec)), rec, question };
};

describe("PilotService questions", () => {
  it("creates a question with parsed options and open status", async () => {
    const { svc, rec } = service();
    const q = await svc.createQuestion("p1", {
      kind: "choice",
      prompt: "Which start date?",
      options: ["2 weeks", "immediately"],
    });

    expect(q.status).toBe("open");
    expect(q.options).toEqual(["2 weeks", "immediately"]);
    expect(rec.questionCreate?.options).toBe(JSON.stringify(["2 weeks", "immediately"]));
  });

  it("answers a question, setting status and answer", async () => {
    const { svc, rec } = service();
    const q = await svc.answerQuestion("p1", "e1", { answer: "2 weeks" });

    expect(q.status).toBe("answered");
    expect(q.answer).toBe("2 weeks");
    expect(rec.questionUpdate?.data).toMatchObject({ status: "answered", answer: "2 weeks" });
    expect(rec.questionUpdate?.data.answeredAt).toBeInstanceOf(Date);
  });

  it("rejects answering a question that is no longer open, leaving it untouched", async () => {
    const { svc, rec, question } = service({ status: "expired" });

    await expect(svc.answerQuestion("p1", "e1", { answer: "too late" })).rejects.toMatchObject({
      status: 409,
    });
    expect(question.status).toBe("expired");
    expect(question.answer).toBeNull();
    expect(rec.questionUpdate).toBeUndefined();
  });

  it("pushes a notification on creation, using the deep link as the url", async () => {
    const { svc, rec } = service();
    await svc.createQuestion("p1", {
      kind: "question",
      prompt: "Approve this application?",
      options: [],
      deepLink: "/pilot/questions/e1",
    });

    expect(rec.pushes).toHaveLength(1);
    expect(rec.pushes[0]).toMatchObject({
      profileId: "p1",
      payload: {
        title: "JobPilot needs you",
        body: "Approve this application?",
        url: "/pilot/questions/e1",
        tag: "question-e1",
      },
    });
  });

  it("defaults a 2fa question to expire in ~5 minutes when none is given", async () => {
    const { svc, rec } = service();
    const before = Date.now();
    await svc.createQuestion("p1", { kind: "2fa", prompt: "Enter the code", options: [] });

    const expiresAt = rec.questionCreate?.expiresAt as Date;
    expect(expiresAt).toBeInstanceOf(Date);
    const ms = expiresAt.getTime() - before;
    expect(ms).toBeGreaterThanOrEqual(4 * 60 * 1000);
    expect(ms).toBeLessThanOrEqual(6 * 60 * 1000);
  });

  it("does not default an expiry for non-2fa questions", async () => {
    const { svc, rec } = service();
    await svc.createQuestion("p1", {
      kind: "question",
      prompt: "Which start date?",
      options: [],
    });

    expect(rec.questionCreate?.expiresAt).toBeNull();
  });
});

describe("PilotService journal", () => {
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
        { kind: "system", summary: "Pilot stopped unexpectedly (watchdog)" },
      ],
    });

    expect(rec.pushes).toHaveLength(1);
    expect(rec.pushes[0]).toMatchObject({
      profileId: "p1",
      payload: {
        title: "Pilot alert",
        body: "Pilot stopped unexpectedly (watchdog)",
        url: "/pilot",
        tag: "pilot-system",
      },
    });
  });
});
