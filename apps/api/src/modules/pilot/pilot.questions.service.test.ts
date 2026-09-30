import { makePush } from "@/common/push/push.fake";
import type { PushPayload } from "@/common/push/push.service";
import type { PrismaClient } from "@/generated/prisma/client";
import type { CampaignJobService } from "@/modules/campaign/jobs/job.service";
import type { PilotJournalService } from "./journal.service";
import { PilotQuestionService, USER_SKIP_REASON } from "./pilot.questions.service";
import { describe, expect, it } from "bun:test";

interface Recorder {
  questionCreate?: Record<string, unknown>;
  questionUpdate?: { data: Record<string, unknown> };
  pushes: { userId: string; payload: PushPayload }[];
  jobResults: { campaignId: string; key: string; body: Record<string, unknown> }[];
  jobPatches: { campaignId: string; key: string; patch: Record<string, unknown> }[];
  failedSkips: { campaignId: string; key: string; skipReason: string }[];
  journal: { entries: { summary: string }[] }[];
}

function makeDb(questionOver: Record<string, unknown> = {}, jobStatus = "needs_user") {
  const rec: Recorder = {
    pushes: [],
    jobResults: [],
    jobPatches: [],
    failedSkips: [],
    journal: [],
  };
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
      updateManyAndReturn: async (a: { data: Record<string, unknown> }) => {
        if (question.status !== "open") return [];
        rec.questionUpdate = { data: a.data };
        Object.assign(question, a.data);
        return [{ ...question }];
      },
    },
    job: { findFirst: async () => ({ status: jobStatus, title: "CTO", company: "Acme" }) },
  };
  const campaignJobs = {
    recordJobResult: async (
      _u: string,
      campaignId: string,
      key: string,
      body: Record<string, unknown>,
    ) => {
      rec.jobResults.push({ campaignId, key, body });
      return { campaignJob: { title: "CTO", company: "Acme" } };
    },
    skipFailedJob: async (_u: string, campaignId: string, key: string, skipReason: string) => {
      rec.failedSkips.push({ campaignId, key, skipReason });
    },
    patchJob: async (
      _u: string,
      campaignId: string,
      key: string,
      patch: Record<string, unknown>,
    ) => {
      rec.jobPatches.push({ campaignId, key, patch });
    },
  };
  const journal = {
    appendJournal: async (_u: string, body: { entries: { summary: string }[] }) => {
      rec.journal.push(body);
    },
  };
  return { db, rec, question, campaignJobs, journal };
}

const service = (questionOver: Record<string, unknown> = {}, jobStatus?: string) => {
  const { db, rec, question, campaignJobs, journal } = makeDb(questionOver, jobStatus);
  return {
    svc: new PilotQuestionService(
      db as unknown as PrismaClient,
      makePush(rec.pushes),
      campaignJobs as unknown as CampaignJobService,
      journal as unknown as PilotJournalService,
    ),
    rec,
    question,
  };
};

const JOB_QUESTION = { subjectType: "job", subjectId: "c1:acme-cto-1" };

describe("PilotQuestionService", () => {
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
    await svc.createQuestion("p1", { kind: "two_factor", prompt: "Enter the code", options: [] });

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

  it("skips the application: records it skipped, journals it, cancels the question", async () => {
    const { svc, rec, question } = service(JOB_QUESTION);
    const q = await svc.skipApplication("p1", "e1");

    expect(rec.jobResults).toEqual([
      {
        campaignId: "c1",
        key: "acme-cto-1",
        body: { outcome: "skipped", skipReason: USER_SKIP_REASON },
      },
    ]);
    expect(rec.journal[0]?.entries[0]?.summary).toContain("CTO at Acme");
    expect(q.status).toBe("cancelled");
    expect(question.status).toBe("cancelled");
  });

  it("refuses to skip an application the pilot is applying to right now", async () => {
    const { svc, rec, question } = service(JOB_QUESTION, "applying");

    await expect(svc.skipApplication("p1", "e1")).rejects.toMatchObject({ status: 409 });
    expect(rec.jobResults).toHaveLength(0);
    expect(question.status).toBe("open");
  });

  it("skips a failed job's application so the retry sweep leaves it alone", async () => {
    const { svc, rec } = service(JOB_QUESTION, "failed");
    const q = await svc.skipApplication("p1", "e1");

    expect(rec.failedSkips).toEqual([
      { campaignId: "c1", key: "acme-cto-1", skipReason: USER_SKIP_REASON },
    ]);
    expect(rec.jobResults).toHaveLength(0);
    expect(rec.journal).toHaveLength(1);
    expect(q.status).toBe("cancelled");
  });

  it("only closes the questions when the job already applied", async () => {
    const { svc, rec } = service(JOB_QUESTION, "applied");
    const q = await svc.skipApplication("p1", "e1");

    expect(rec.jobResults).toHaveLength(0);
    expect(rec.failedSkips).toHaveLength(0);
    expect(rec.journal).toHaveLength(0);
    expect(q.status).toBe("cancelled");
  });

  it("refuses to skip the application of a question with no job", async () => {
    const { svc } = service({ subjectType: "board", subjectId: "theladders.com" });
    await expect(svc.skipApplication("p1", "e1")).rejects.toMatchObject({ status: 409 });
  });

  it("skips the question, requeueing its parked job", async () => {
    const { svc, rec } = service(JOB_QUESTION);
    const q = await svc.skipQuestion("p1", "e1");

    expect(rec.jobPatches).toEqual([
      { campaignId: "c1", key: "acme-cto-1", patch: { status: "approved" } },
    ]);
    expect(q.status).toBe("cancelled");
  });

  it("skips the question without touching a job that is no longer parked", async () => {
    const { svc, rec } = service(JOB_QUESTION, "skipped");
    await svc.skipQuestion("p1", "e1");
    expect(rec.jobPatches).toHaveLength(0);
  });

  it("refuses to skip a question that is no longer open", async () => {
    const { svc, rec } = service({ ...JOB_QUESTION, status: "answered" });
    await expect(svc.skipQuestion("p1", "e1")).rejects.toMatchObject({ status: 409 });
    expect(rec.jobPatches).toHaveLength(0);
  });
});
