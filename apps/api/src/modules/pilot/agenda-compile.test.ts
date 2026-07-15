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
