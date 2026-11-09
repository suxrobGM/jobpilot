import type { PrismaClient } from "@/generated/prisma/client";
import { makePush } from "@/modules/web-push/web-push.fake";
import type { PushPayload } from "@/modules/web-push/web-push.service";
import { ProfileAnswerService } from "./answer.service";
import { PilotQuestionService } from "./question.service";
import { describe, expect, it } from "bun:test";

type Row = Record<string, unknown>;

function makeService(over: Row = {}) {
  const rec = {
    created: null as Row | null,
    pushes: [] as { userId: string; payload: PushPayload }[],
    savedAnswers: [] as unknown[],
    jobSkips: [] as unknown[],
  };
  const question: Row = {
    id: "e1",
    userId: "p1",
    kind: "question",
    status: "open",
    subjectType: null,
    subjectId: null,
    prompt: "q",
    options: [],
    link: null,
    answer: null,
    savedAnswerKey: null,
    answeredAt: null,
    expiresAt: null,
    createdAt: new Date(),
    ...over,
  };
  const db = {
    pilotQuestion: {
      create: async (a: { data: Row }) => {
        rec.created = a.data;
        return { ...question, ...a.data };
      },
      findFirst: async () => question,
      updateManyAndReturn: async (a: { where: { status: string }; data: Row }) => {
        if (question.status !== a.where.status) {
          return [];
        }
        Object.assign(question, a.data);
        return [question];
      },
    },
    profileAnswer: { upsert: async (args: unknown) => rec.savedAnswers.push(args) },
    job: {
      updateManyAndReturn: async (args: unknown) => {
        rec.jobSkips.push(args);
        return [];
      },
    },
  };
  const prisma = db as unknown as PrismaClient;
  const svc = new PilotQuestionService(
    prisma,
    makePush(rec.pushes),
    new ProfileAnswerService(prisma),
  );
  return { svc, rec, question };
}

describe("PilotQuestionService.create", () => {
  it("opens the question and pushes it, linking to its deep link", async () => {
    const { svc, rec } = makeService();
    const question = await svc.create("p1", {
      kind: "choice",
      prompt: "Which start date?",
      options: ["2 weeks", "immediately"],
      link: "/pilot/questions/e1",
    });
    expect(question).toMatchObject({ status: "open", options: ["2 weeks", "immediately"] });
    // Unanswered, it lapses in two weeks and frees whatever it parked.
    const expiresAt = rec.created?.expiresAt as Date;
    const ttlDays = (expiresAt.getTime() - Date.now()) / 86_400_000;
    expect(Math.round(ttlDays)).toBe(14);
    expect(rec.pushes[0]?.payload).toEqual({
      title: "JobPilot needs you",
      body: "Which start date?",
      url: "/pilot/questions/e1",
      tag: "question-e1",
    });
  });

  it("expires an unanswered 2FA question after about five minutes", async () => {
    const { svc, rec } = makeService();
    await svc.create("p1", { kind: "two_factor", prompt: "Enter the code", options: [] });
    const expiresAt = rec.created?.expiresAt;
    if (!(expiresAt instanceof Date)) {
      throw new Error("expected an expiry");
    }
    const minutes = (expiresAt.getTime() - Date.now()) / 60_000;
    expect(minutes).toBeGreaterThan(4);
    expect(minutes).toBeLessThanOrEqual(5);
  });
});

describe("PilotQuestionService.answer", () => {
  it("records the answer on an open question", async () => {
    const { svc } = makeService();
    const question = await svc.answer("p1", "e1", { answer: "2 weeks" });
    expect(question).toMatchObject({
      status: "answered",
      answer: "2 weeks",
      answeredAt: expect.any(Date),
    });
  });

  it("saves the answer to a keyed question for reuse", async () => {
    const { svc, rec } = makeService({ savedAnswerKey: "relocation" });
    await svc.answer("p1", "e1", { answer: "Yes, anywhere in the US" });
    expect(rec.savedAnswers).toEqual([
      expect.objectContaining({
        where: { userId_key: { userId: "p1", key: "relocation" } },
        update: { value: "Yes, anywhere in the US" },
      }),
    ]);
  });

  it("never saves a 2FA code, even when keyed", async () => {
    const { svc, rec } = makeService({ kind: "two_factor", savedAnswerKey: "otp" });
    await svc.answer("p1", "e1", { answer: "123456" });
    expect(rec.savedAnswers).toHaveLength(0);
  });

  it("refuses a question that expired, leaving it as it was", async () => {
    const { svc, question } = makeService({ status: "expired" });
    await expect(svc.answer("p1", "e1", { answer: "too late" })).rejects.toMatchObject({
      status: 409,
    });
    expect(question).toMatchObject({ status: "expired", answer: null });
  });

  it("skips the parked job itself when the user skips a job question", async () => {
    const { svc, rec } = makeService({ subjectType: "job", subjectId: "f1:k1" });
    await svc.answer("p1", "e1", { answer: "Skip" });
    expect(rec.jobSkips).toEqual([
      expect.objectContaining({
        where: { userId: "p1", status: "needs_user", feedId: "f1", key: "k1" },
        data: { status: "skipped", skipReason: "Skipped by user." },
      }),
    ]);
  });

  it("leaves any other job answer for the agent", async () => {
    const { svc, rec } = makeService({ subjectType: "job", subjectId: "f1:k1" });
    await svc.answer("p1", "e1", { answer: "Solved" });
    expect(rec.jobSkips).toHaveLength(0);
  });
});
