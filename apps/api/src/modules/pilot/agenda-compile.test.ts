// Compile-level gather behavior (escalation consumption, warm-check join, promotion cadence) driven
// through AgendaService.compile with a fake Prisma - no database. Loading the service transitively
// loads `@/env`, satisfied by the local .env / ci.yml dummy env.
import { AgendaService } from "./agenda.service";
import { approvedJob, makeAgendaDeps, type Over } from "./pilot.test-helpers";
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
