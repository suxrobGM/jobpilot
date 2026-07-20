// Fake-Prisma unit test for PilotService: the question lifecycle (journal lives in journal.service.test.ts).
// Injects a fake Prisma directly (no database); publish() is a no-op without subscribers.
import type { PushPayload } from "@/common/push";
import type { PrismaClient } from "@/generated/prisma/client";
import { makePush } from "./agenda/db.test-helpers";
import { PilotService } from "./pilot.service";
import { describe, expect, it } from "bun:test";

interface Recorder {
  questionCreate?: Record<string, unknown>;
  questionUpdate?: { data: Record<string, unknown> };
  pushes: { userId: string; payload: PushPayload }[];
}

function makeDb(questionOver: Record<string, unknown> = {}) {
  const rec: Recorder = { pushes: [] };
  // A single mutable question row so the status guard in updateMany is observable.
  const question: Record<string, unknown> = {
    id: "e1",
    userId: "p1",
    kind: "question",
    status: "open",
    subjectType: null,
    subjectId: null,
    prompt: "q",
    options: [],
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
    expect(rec.questionCreate?.options).toEqual(["2 weeks", "immediately"]);
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
      userId: "p1",
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
