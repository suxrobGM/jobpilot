// Compile-level gather behavior (escalation consumption, warm-check join, promotion cadence) driven
// through AgendaService.compile with a fake Prisma - no database. Loading the service transitively
// loads `@/env`, satisfied by the local .env / ci.yml dummy env.

import { approvedJob, makeAgendaDeps, type Over } from "./db.test-helpers";
import { AgendaService } from "./service";
import { describe, expect, it } from "bun:test";

const service = (over: Over = {}) => {
  const { prisma, campaignJobs, pilot, push } = makeAgendaDeps(over);
  return new AgendaService(prisma, campaignJobs, pilot, push);
};

describe("AgendaService escalation consumption", () => {
  it("keeps an answered escalation on the agenda until a lease references it", async () => {
    const agenda = await service({
      answered: [{ id: "E1", kind: "question", question: "Which date?" }],
    }).compile("p1");
    expect(agenda.items.map((i) => i.kind)).toContain("escalation.answered");
  });

  it("drops an answered escalation once a lease has referenced it", async () => {
    const agenda = await service({
      answered: [{ id: "E1", kind: "question", question: "Which date?" }],
      escalationLeases: [{ subjectId: "E1" }],
    }).compile("p1");
    expect(agenda.items.some((i) => i.kind === "escalation.answered")).toBe(false);
  });
});

describe("AgendaService warm-check join", () => {
  const insider = {
    id: "ct1",
    name: "Insider",
    title: "Staff Eng",
    email: "in@acme.test",
    company: "Acme, Inc.",
  };

  it("attaches same-company contacts and emits a warmIntro for a >=85 job", async () => {
    const agenda = await service({
      approvedJobs: [approvedJob({ matchScore: 90, company: "Acme" })],
      contacts: [insider],
    }).compile("p1");
    const warm = agenda.items.find((i) => i.kind === "outreach.warmIntro");
    const warmContacts = warm?.payload.contacts as { id: string }[] | undefined;
    expect(warmContacts?.[0].id).toBe("ct1");
    const apply = agenda.items.find((i) => i.kind === "job.apply");
    const applyWarm = apply?.payload.warmContacts as { id: string }[] | undefined;
    expect(applyWarm?.[0].id).toBe("ct1");
  });

  it("does not emit a warmIntro below the score threshold", async () => {
    const agenda = await service({
      approvedJobs: [approvedJob({ matchScore: 84, company: "Acme" })],
      contacts: [insider],
    }).compile("p1");
    expect(agenda.items.some((i) => i.kind === "outreach.warmIntro")).toBe(false);
  });
});

describe("AgendaService interview replies", () => {
  const replyApp = (over: Record<string, unknown> = {}) => ({
    id: "app1",
    company: "Acme",
    title: "Engineer",
    events: [],
    emailMessages: [
      {
        id: "em1",
        threadId: "t1",
        fromAddress: "dana@acme.test",
        subject: "Re: interview",
        receivedAt: new Date("2026-07-14T12:00:00.000Z"),
      },
    ],
    ...over,
  });

  it("emits interview.reply for an interviewing app with an unreplied inbound email", async () => {
    const agenda = await service({ interviewReplyApps: [replyApp()] }).compile("p1");
    const item = agenda.items.find((i) => i.kind === "interview.reply");
    expect(item?.subjectId).toBe("em1");
    expect(item?.payload).toMatchObject({ applicationId: "app1", emailMessageId: "em1" });
  });

  it("suppresses interview.reply once an outbound email event is logged", async () => {
    const agenda = await service({
      interviewReplyApps: [replyApp({ events: [{ id: "ev1" }] })],
    }).compile("p1");
    expect(agenda.items.some((i) => i.kind === "interview.reply")).toBe(false);
  });

  it("suppresses interview.reply while an open/answered escalation exists for the email", async () => {
    const agenda = await service({
      interviewReplyApps: [replyApp()],
      interviewEscalations: [{ subjectId: "em1" }],
    }).compile("p1");
    expect(agenda.items.some((i) => i.kind === "interview.reply")).toBe(false);
  });

  it("emits no interview.reply for an app without a matched interview email", async () => {
    const agenda = await service({
      interviewReplyApps: [replyApp({ emailMessages: [] })],
    }).compile("p1");
    expect(agenda.items.some((i) => i.kind === "interview.reply")).toBe(false);
  });
});

describe("AgendaService interview prep", () => {
  it("emits interview.prep with a resumeId derived from the campaign config", async () => {
    const agenda = await service({
      interviewPrepApps: [
        {
          id: "app1",
          company: "Acme",
          title: "Engineer",
          url: "https://x/1",
          campaign: { config: JSON.stringify({ resumeId: "r1" }) },
        },
      ],
    }).compile("p1");
    const item = agenda.items.find((i) => i.kind === "interview.prep");
    expect(item?.subjectId).toBe("app1");
    expect(item?.payload).toMatchObject({
      applicationId: "app1",
      resumeId: "r1",
      jobUrl: "https://x/1",
    });
  });

  it("derives a null resumeId when the app has no campaign", async () => {
    const agenda = await service({
      interviewPrepApps: [
        { id: "app1", company: "Acme", title: "Engineer", url: "https://x/1", campaign: null },
      ],
    }).compile("p1");
    const item = agenda.items.find((i) => i.kind === "interview.prep");
    expect(item?.payload.resumeId).toBeNull();
  });
});

describe("AgendaService escalation enrichment", () => {
  it("carries the escalation subject and Q/A into the answered payload", async () => {
    const agenda = await service({
      answered: [
        {
          id: "E1",
          kind: "approval",
          question: "Send this reply?",
          subjectType: "email",
          subjectId: "em1",
          answer: "yes",
        },
      ],
    }).compile("p1");
    const item = agenda.items.find((i) => i.kind === "escalation.answered");
    expect(item?.payload).toEqual({
      escalationId: "E1",
      escalationKind: "approval",
      subjectType: "email",
      subjectId: "em1",
      question: "Send this reply?",
      answer: "yes",
    });
  });
});

describe("AgendaService promotion cadence", () => {
  const venueConfig = JSON.stringify({ promotion: { venues: [{ venue: "hn", cadenceDays: 30 }] } });

  it("emits promo.compose for a venue whose cadence is due (no prior post)", async () => {
    const agenda = await service({ mandateConfig: venueConfig }).compile("p1");
    expect(agenda.items.some((i) => i.kind === "promo.compose")).toBe(true);
  });

  it("suppresses promo.compose while a recent non-declined post exists", async () => {
    const agenda = await service({
      mandateConfig: venueConfig,
      venuePosts: [{ venue: "hn", createdAt: new Date() }],
    }).compile("p1");
    expect(agenda.items.some((i) => i.kind === "promo.compose")).toBe(false);
  });
});

describe("AgendaService queue.drain", () => {
  it("emits a batch item from pending queue entries", async () => {
    const agenda = await service({
      pendingQueue: [{ id: "q1", url: "https://x/1" }],
      pendingQueueCount: 3,
    }).compile("p1");
    const item = agenda.items.find((i) => i.kind === "queue.drain");
    expect(item?.payload).toEqual({
      entries: [{ id: "q1", url: "https://x/1" }],
      pendingCount: 3,
    });
  });

  it("emits no queue.drain when nothing is pending", async () => {
    const agenda = await service({}).compile("p1");
    expect(agenda.items.some((i) => i.kind === "queue.drain")).toBe(false);
  });
});

describe("AgendaService board.health", () => {
  // Newest-first apply outcomes for one board; a leading run of failures is the unhealthy signal.
  const failed = (key: string) => ({
    campaignId: "c1",
    key,
    url: `https://x/${key}`,
    board: "linkedin",
    status: "failed",
    failReason: "captcha wall",
  });
  const applied = (key: string) => ({ ...failed(key), status: "applied", failReason: null });

  it("flags a board with 3+ consecutive apply failures", async () => {
    const agenda = await service({
      boardHealthJobs: [failed("a"), failed("b"), failed("c")],
    }).compile("p1");
    const item = agenda.items.find((i) => i.kind === "board.health");
    expect(item?.subjectId).toBe("linkedin");
    expect(item?.payload).toMatchObject({
      board: "linkedin",
      consecutiveFailures: 3,
      probeJob: { campaignId: "c1", jobKey: "a", url: "https://x/a" },
    });
  });

  it("does not flag when a recent success breaks the failure streak", async () => {
    const agenda = await service({
      boardHealthJobs: [failed("a"), failed("b"), applied("c"), failed("d")],
    }).compile("p1");
    expect(agenda.items.some((i) => i.kind === "board.health")).toBe(false);
  });

  it("excludes a parked board from the health warning", async () => {
    const agenda = await service({
      mandateConfig: JSON.stringify({ parkedBoards: ["linkedin"] }),
      boardHealthJobs: [failed("a"), failed("b"), failed("c")],
    }).compile("p1");
    expect(agenda.items.some((i) => i.kind === "board.health")).toBe(false);
  });
});

describe("AgendaService parkedBoards enforcement", () => {
  const parked = JSON.stringify({
    parkedBoards: ["linkedin"],
    standingQueries: [
      { query: "react", board: "linkedin" },
      { query: "golang", board: "indeed" },
    ],
  });

  it("excludes approved jobs on a parked board from job.apply", async () => {
    const agenda = await service({
      mandateConfig: parked,
      approvedJobs: [
        approvedJob({ key: "on-parked", board: "linkedin" }),
        approvedJob({ key: "on-live", board: "indeed" }),
      ],
    }).compile("p1");
    const applyKeys = agenda.items.filter((i) => i.kind === "job.apply").map((i) => i.subjectId);
    expect(applyKeys).toEqual(["on-live"]);
  });

  it("excludes standing queries on a parked board from search.discover", async () => {
    const agenda = await service({ mandateConfig: parked }).compile("p1");
    const discovered = agenda.items
      .filter((i) => i.kind === "search.discover")
      .map((i) => (i.payload as { query: string }).query);
    expect(discovered).toEqual(["golang"]);
  });
});

describe("AgendaService quiet-agenda candidates", () => {
  // 40 found, 4 qualified (ratio 0.1 < 0.2), 36 skipped, 5 failed - trips every maintenance threshold.
  const laggard = {
    campaignId: "c1",
    query: "react",
    config: JSON.stringify({ minScore: 70, board: "linkedin" }),
    summary: JSON.stringify({
      totalFound: 40,
      qualified: 4,
      applied: 1,
      skipped: 36,
      failed: 5,
    }),
  };

  it("emits strategyReview with counts and top skip reasons for a poorly-converting campaign", async () => {
    const agenda = await service({
      quietCampaigns: [laggard],
      skipReasonRows: [{ skipReason: "overqualified", _count: { _all: 20 } }],
    }).compile("p1");
    const item = agenda.items.find((i) => i.kind === "campaign.strategyReview");
    expect(item?.payload).toMatchObject({
      campaignId: "c1",
      config: { minScore: 70, board: "linkedin" },
      counts: { totalFound: 40, qualified: 4, applied: 1, skipped: 36 },
      topSkipReasons: ["overqualified"],
    });
  });

  it("emits rescanSkipped and retryFailed from the persisted summary", async () => {
    const agenda = await service({ quietCampaigns: [laggard] }).compile("p1");
    expect(agenda.items.find((i) => i.kind === "job.rescanSkipped")?.payload).toMatchObject({
      campaignId: "c1",
      skippedCount: 36,
    });
    expect(agenda.items.find((i) => i.kind === "job.retryFailed")?.payload).toMatchObject({
      campaignId: "c1",
      failedCount: 5,
    });
  });

  it("dedupes each maintenance kind against a marker journalled in the last 7 days", async () => {
    const agenda = await service({
      quietCampaigns: [laggard],
      actionMarkers: [
        { subjectId: "c1", detail: JSON.stringify({ type: "strategyReview" }) },
        { subjectId: "c1", detail: JSON.stringify({ type: "rescanSkipped" }) },
        { subjectId: "c1", detail: JSON.stringify({ type: "retryFailed" }) },
      ],
    }).compile("p1");
    expect(agenda.items.some((i) => i.kind === "campaign.strategyReview")).toBe(false);
    expect(agenda.items.some((i) => i.kind === "job.rescanSkipped")).toBe(false);
    expect(agenda.items.some((i) => i.kind === "job.retryFailed")).toBe(false);
  });

  it("keeps candidates when the only markers are for unrelated subjects", async () => {
    const agenda = await service({
      quietCampaigns: [laggard],
      actionMarkers: [{ subjectId: "other", detail: JSON.stringify({ type: "strategyReview" }) }],
    }).compile("p1");
    expect(agenda.items.some((i) => i.kind === "campaign.strategyReview")).toBe(true);
  });
});
