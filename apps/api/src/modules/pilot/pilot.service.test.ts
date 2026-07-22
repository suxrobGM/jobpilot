// Fake-Prisma unit test for PilotService: the question lifecycle (journal lives in journal.service.test.ts).
// Injects a fake Prisma directly (no database); publish() is a no-op without subscribers.
import { pilotInstructionsConfigSchema } from "@jobpilot/contracts/pilot";
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
    pilotQuestion: {
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

function activityService(
  cycleEntry: Record<string, unknown> | null,
  state: { running: boolean } | null = { running: true },
) {
  const noMax = { _max: { createdAt: null, updatedAt: null } };
  const db = {
    pilotClaim: { findMany: async () => [] },
    pilotJournalEntry: {
      aggregate: async () => noMax,
      findFirst: async () => cycleEntry,
    },
    campaign: { aggregate: async () => noMax },
    job: { aggregate: async () => noMax },
    pilotState: { findUnique: async () => state },
  };
  return new PilotService(db as unknown as PrismaClient, makePush({ pushes: [] }));
}

function instructionsService(prevGoals: string) {
  const rec = { searchResets: 0 };
  const stateRow = (goals: string) => ({
    userId: "p1",
    running: false,
    instructionsGoals: goals,
    instructionsConfig: {},
    instructionsUpdatedAt: new Date(),
    lastCycleAt: null,
    cycleCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  const db = {
    pilotState: {
      findUnique: async () => ({ instructionsGoals: prevGoals }),
      upsert: async (a: { update: { instructionsGoals: string } }) =>
        stateRow(a.update.instructionsGoals),
    },
    pilotSearch: {
      updateMany: async () => {
        rec.searchResets++;
        return { count: 0 };
      },
    },
    application: { count: async () => 0 },
  };
  return { svc: new PilotService(db as unknown as PrismaClient, makePush({ pushes: [] })), rec };
}

describe("PilotService.updateInstructions", () => {
  const body = (goals: string) => ({ goals, config: pilotInstructionsConfigSchema.parse({}) });

  it("resets every search's scheduling when the goals change", async () => {
    const { svc, rec } = instructionsService("old goals");
    await svc.updateInstructions("p1", body("new goals"));
    expect(rec.searchResets).toBe(1);
  });

  it("leaves searches untouched when the goals are unchanged", async () => {
    const { svc, rec } = instructionsService("same goals");
    await svc.updateInstructions("p1", body("same goals"));
    expect(rec.searchResets).toBe(0);
  });
});

function runStateService(goals: string) {
  const stateRow = (running: boolean) => ({
    userId: "p1",
    running,
    instructionsGoals: goals,
    instructionsConfig: {},
    instructionsUpdatedAt: new Date(),
    lastCycleAt: null,
    cycleCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  const db = {
    pilotState: {
      findUnique: async () => ({ instructionsGoals: goals }),
      upsert: async (a: { update: { running: boolean } }) => stateRow(a.update.running),
    },
    application: { count: async () => 0 },
  };
  return new PilotService(db as unknown as PrismaClient, makePush({ pushes: [] }));
}

describe("PilotService.start goals guard", () => {
  it("rejects starting when the goals are empty", async () => {
    const svc = runStateService("   ");
    await expect(svc.start("p1")).rejects.toMatchObject({ status: 409 });
  });

  it("starts when the goals are non-empty", async () => {
    const svc = runStateService("ship senior frontend roles");
    const state = await svc.start("p1");
    expect(state.running).toBe(true);
  });

  it("stops without guarding on empty goals", async () => {
    const svc = runStateService("");
    const state = await svc.stop("p1");
    expect(state.running).toBe(false);
  });
});

describe("PilotService.getActivity lastCycle", () => {
  const completedAt = new Date("2026-07-20T12:00:00Z");

  it("maps the newest cycle entry's detail into lastCycle", async () => {
    const svc = activityService({
      cycleId: "cyc-1",
      createdAt: completedAt,
      detail: { status: "ok", sleepSeconds: 300 },
    });
    const { lastCycle } = await svc.getActivity("p1");
    expect(lastCycle).toEqual({
      cycleId: "cyc-1",
      completedAt,
      status: "ok",
      sleepSeconds: 300,
    });
  });

  it("nulls status and sleepSeconds for a detail-less cycle (the stall-recovery path)", async () => {
    const svc = activityService({ cycleId: null, createdAt: completedAt, detail: {} });
    const { lastCycle } = await svc.getActivity("p1");
    expect(lastCycle).toEqual({
      cycleId: null,
      completedAt,
      status: null,
      sleepSeconds: null,
    });
  });

  it("returns null lastCycle when no cycle entry exists", async () => {
    const svc = activityService(null);
    const { lastCycle } = await svc.getActivity("p1");
    expect(lastCycle).toBeNull();
  });
});

describe("PilotService.getActivity running", () => {
  it("carries the run-state the host's pre-inject gate reads", async () => {
    expect((await activityService(null, { running: true }).getActivity("p1")).running).toBe(true);
    expect((await activityService(null, { running: false }).getActivity("p1")).running).toBe(false);
  });

  it("reads a profile with no PilotState row as stopped", async () => {
    expect((await activityService(null, null).getActivity("p1")).running).toBe(false);
  });
});
