import { makePush } from "@/common/push/push.fake";
import type { PushPayload } from "@/common/push/push.service";
import type { PrismaClient } from "@/generated/prisma/client";
import type { CampaignJobService } from "@/modules/campaign/jobs/job.service";
import { ProfileAnswerService } from "./answer.service";
import type { PilotJournalService } from "./journal.service";
import { PilotQuestionService, USER_SKIP_REASON } from "./question.service";
import { describe, expect, it } from "bun:test";

type Row = Record<string, unknown>;

function makeService(over: Row = {}, jobStatus = "needs_user") {
  const rec = {
    created: null as Row | null,
    pushes: [] as { userId: string; payload: PushPayload }[],
    savedAnswers: [] as unknown[],
    jobResults: [] as { campaignId: string; key: string; body: Row }[],
    jobPatches: [] as { campaignId: string; key: string; patch: Row }[],
    failedSkips: [] as { campaignId: string; key: string; skipReason: string }[],
    journal: [] as { entries: { summary: string }[] }[],
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
    deepLink: null,
    answer: null,
    answerKey: null,
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
        if (question.status !== a.where.status) return [];
        Object.assign(question, a.data);
        return [question];
      },
    },
    profileAnswer: { upsert: async (args: unknown) => rec.savedAnswers.push(args) },
    job: { findFirst: async () => ({ status: jobStatus, title: "CTO", company: "Acme" }) },
  };
  const campaignJobs = {
    recordJobResult: async (_u: string, campaignId: string, key: string, body: Row) => {
      rec.jobResults.push({ campaignId, key, body });
    },
    skipFailedJob: async (_u: string, campaignId: string, key: string, skipReason: string) => {
      rec.failedSkips.push({ campaignId, key, skipReason });
    },
    patchJob: async (_u: string, campaignId: string, key: string, patch: Row) => {
      rec.jobPatches.push({ campaignId, key, patch });
    },
  };
  const journal = {
    appendJournal: async (_u: string, body: { entries: { summary: string }[] }) => {
      rec.journal.push(body);
    },
  };
  const prisma = db as unknown as PrismaClient;
  const svc = new PilotQuestionService(
    prisma,
    makePush(rec.pushes),
    new ProfileAnswerService(prisma),
    campaignJobs as unknown as CampaignJobService,
    journal as unknown as PilotJournalService,
  );
  return { svc, rec, question };
}

describe("PilotQuestionService.createQuestion", () => {
  it("opens the question and pushes it, linking to its deep link", async () => {
    const { svc, rec } = makeService();
    const question = await svc.createQuestion("p1", {
      kind: "choice",
      prompt: "Which start date?",
      options: ["2 weeks", "immediately"],
      deepLink: "/pilot/questions/e1",
    });
    expect(question).toMatchObject({ status: "open", options: ["2 weeks", "immediately"] });
    expect(rec.created?.expiresAt).toBeNull();
    expect(rec.pushes[0]?.payload).toEqual({
      title: "JobPilot needs you",
      body: "Which start date?",
      url: "/pilot/questions/e1",
      tag: "question-e1",
    });
  });

  it("expires an unanswered 2FA question after about five minutes", async () => {
    const { svc, rec } = makeService();
    await svc.createQuestion("p1", { kind: "two_factor", prompt: "Enter the code", options: [] });
    const expiresAt = rec.created?.expiresAt;
    if (!(expiresAt instanceof Date)) throw new Error("expected an expiry");
    const minutes = (expiresAt.getTime() - Date.now()) / 60_000;
    expect(minutes).toBeGreaterThan(4);
    expect(minutes).toBeLessThanOrEqual(5);
  });
});

describe("PilotQuestionService.answerQuestion", () => {
  it("records the answer on an open question", async () => {
    const { svc } = makeService();
    const question = await svc.answerQuestion("p1", "e1", { answer: "2 weeks" });
    expect(question).toMatchObject({
      status: "answered",
      answer: "2 weeks",
      answeredAt: expect.any(Date),
    });
  });

  it("saves the answer to a keyed question for reuse", async () => {
    const { svc, rec } = makeService({ answerKey: "relocation" });
    await svc.answerQuestion("p1", "e1", { answer: "Yes, anywhere in the US" });
    expect(rec.savedAnswers).toEqual([
      expect.objectContaining({
        where: { userId_key: { userId: "p1", key: "relocation" } },
        update: { value: "Yes, anywhere in the US" },
      }),
    ]);
  });

  it("never saves a 2FA code, even when keyed", async () => {
    const { svc, rec } = makeService({ kind: "two_factor", answerKey: "otp" });
    await svc.answerQuestion("p1", "e1", { answer: "123456" });
    expect(rec.savedAnswers).toHaveLength(0);
  });

  it("refuses a question that expired, leaving it as it was", async () => {
    const { svc, question } = makeService({ status: "expired" });
    await expect(svc.answerQuestion("p1", "e1", { answer: "too late" })).rejects.toMatchObject({
      status: 409,
    });
    expect(question).toMatchObject({ status: "expired", answer: null });
  });
});

const JOB_QUESTION = { subjectType: "job", subjectId: "c1:acme-cto-1" };

describe("PilotQuestionService.skipApplication", () => {
  it("records the job skipped, journals it, and cancels the question", async () => {
    const { svc, rec, question } = makeService(JOB_QUESTION);
    const skipped = await svc.skipApplication("p1", "e1");
    expect(rec.jobResults).toEqual([
      {
        campaignId: "c1",
        key: "acme-cto-1",
        body: { outcome: "skipped", skipReason: USER_SKIP_REASON },
      },
    ]);
    expect(rec.journal[0]?.entries[0]?.summary).toContain("CTO at Acme");
    expect(skipped.status).toBe("cancelled");
    expect(question.status).toBe("cancelled");
  });

  it("refuses while the pilot is applying to the job", async () => {
    const { svc, rec, question } = makeService(JOB_QUESTION, "applying");
    await expect(svc.skipApplication("p1", "e1")).rejects.toMatchObject({ status: 409 });
    expect(rec.jobResults).toHaveLength(0);
    expect(question.status).toBe("open");
  });

  it("skips a failed job so the retry sweep leaves it alone", async () => {
    const { svc, rec } = makeService(JOB_QUESTION, "failed");
    const skipped = await svc.skipApplication("p1", "e1");
    expect(rec.failedSkips).toEqual([
      { campaignId: "c1", key: "acme-cto-1", skipReason: USER_SKIP_REASON },
    ]);
    expect(rec.jobResults).toHaveLength(0);
    expect(rec.journal).toHaveLength(1);
    expect(skipped.status).toBe("cancelled");
  });

  it("only closes the questions when the job already applied", async () => {
    const { svc, rec } = makeService(JOB_QUESTION, "applied");
    const skipped = await svc.skipApplication("p1", "e1");
    expect(rec.jobResults).toHaveLength(0);
    expect(rec.failedSkips).toHaveLength(0);
    expect(rec.journal).toHaveLength(0);
    expect(skipped.status).toBe("cancelled");
  });

  it("refuses a question with no job", async () => {
    const { svc } = makeService({ subjectType: "board", subjectId: "theladders.com" });
    await expect(svc.skipApplication("p1", "e1")).rejects.toMatchObject({ status: 409 });
  });
});

describe("PilotQuestionService.skipQuestion", () => {
  it("cancels the question and requeues its parked job", async () => {
    const { svc, rec } = makeService(JOB_QUESTION);
    const skipped = await svc.skipQuestion("p1", "e1");
    expect(rec.jobPatches).toEqual([
      { campaignId: "c1", key: "acme-cto-1", patch: { status: "approved" } },
    ]);
    expect(skipped.status).toBe("cancelled");
  });

  it("leaves a job that is no longer parked alone", async () => {
    const { svc, rec } = makeService(JOB_QUESTION, "skipped");
    await svc.skipQuestion("p1", "e1");
    expect(rec.jobPatches).toHaveLength(0);
  });

  it("refuses a question that is no longer open", async () => {
    const { svc, rec } = makeService({ ...JOB_QUESTION, status: "answered" });
    await expect(svc.skipQuestion("p1", "e1")).rejects.toMatchObject({ status: 409 });
    expect(rec.jobPatches).toHaveLength(0);
  });
});
