import { HOUR_MS } from "@/common/date/buckets";
import { approvedJob, pilotSearchRow, service } from "./fakes";
import { describe, expect, it } from "bun:test";

const dueRow = (over: Record<string, unknown> = {}) =>
  pilotSearchRow({ nextRunAt: new Date(Date.now() - HOUR_MS), ...over });
const futureRow = (over: Record<string, unknown> = {}) =>
  pilotSearchRow({ nextRunAt: new Date(Date.now() + HOUR_MS), ...over });

describe("AgendaService warm-check join", () => {
  const insider = {
    id: "ct1",
    name: "Insider",
    title: "Staff Eng",
    email: "in@acme.test",
    company: "Acme, Inc.",
  };

  it("attaches same-company contacts and emits a warmIntro for a >=80 job", async () => {
    const agenda = await service({
      approvedJobs: [approvedJob({ matchScore: 90, company: "Acme" })],
      contacts: [insider],
    }).refresh("p1");
    const warm = agenda.items.find((i) => i.kind === "networking.warmIntro");
    const warmContacts = warm?.payload.contacts as { id: string }[] | undefined;
    expect(warmContacts?.[0].id).toBe("ct1");
    const apply = agenda.items.find((i) => i.kind === "job.apply");
    const applyWarm = apply?.payload.warmContacts as { id: string }[] | undefined;
    expect(applyWarm?.[0].id).toBe("ct1");
  });

  it("does not emit a warmIntro below the score threshold", async () => {
    const agenda = await service({
      approvedJobs: [approvedJob({ matchScore: 79, company: "Acme" })],
      contacts: [insider],
    }).refresh("p1");
    expect(agenda.items.some((i) => i.kind === "networking.warmIntro")).toBe(false);
  });

  it("keeps a recently-applied high scorer in the warm-intro pool", async () => {
    const agenda = await service({
      approvedJobs: [],
      recentAppliedJobs: [approvedJob({ matchScore: 90, company: "Acme", key: "done1" })],
      contacts: [insider],
    }).refresh("p1");
    const warm = agenda.items.find((i) => i.kind === "networking.warmIntro");
    expect(warm?.subjectId).toBe("c1:done1");
    expect(agenda.items.some((i) => i.kind === "job.apply")).toBe(false);
  });

  it("damps a warm intro whose claim already ran", async () => {
    const agenda = await service({
      approvedJobs: [],
      recentAppliedJobs: [approvedJob({ matchScore: 90, company: "Acme", key: "done1" })],
      warmIntroClaims: [
        {
          subjectId: "c1:done1",
          grantedAt: new Date(),
          releasedAt: new Date(),
          outcome: "done",
        },
      ],
      contacts: [insider],
    }).refresh("p1");
    expect(agenda.items.some((i) => i.kind === "networking.warmIntro")).toBe(false);
  });

  it("keeps warmContacts on the apply item of a job damped out of the intro pool", async () => {
    const agenda = await service({
      approvedJobs: [approvedJob({ matchScore: 90, company: "Acme", key: "j1" })],
      warmIntroClaims: [
        { subjectId: "c1:j1", grantedAt: new Date(), releasedAt: new Date(), outcome: "done" },
      ],
      contacts: [insider],
    }).refresh("p1");
    expect(agenda.items.some((i) => i.kind === "networking.warmIntro")).toBe(false);
    const apply = agenda.items.find((i) => i.kind === "job.apply");
    const applyWarm = apply?.payload.warmContacts as { id: string }[] | undefined;
    expect(applyWarm?.[0].id).toBe("ct1");
  });
});

describe("AgendaService discover due selection", () => {
  it("emits a search.discover item carrying the search id as subject and target", async () => {
    const agenda = await service({
      pilotSearches: [dueRow({ id: "s-react", query: "react" })],
    }).refresh("p1");
    const item = agenda.items.find((i) => i.kind === "search.discover");
    expect(item?.subjectId).toBe("s-react");
    expect(item?.id).toBe("search.discover:s-react");
    expect(item?.payload).toMatchObject({ searchId: "s-react", query: "react", maxPages: 5 });
    const payload = item?.payload as { newJobsTarget: number } | undefined;
    expect(payload?.newJobsTarget).toBeGreaterThanOrEqual(5);
  });

  it("suppresses a search whose nextRunAt is in the future and lastRunAt is recent", async () => {
    const agenda = await service({
      // Recent run ⇒ not hungry-eligible either, so nothing surfaces.
      pilotSearches: [futureRow({ lastRunAt: new Date() })],
    }).refresh("p1");
    expect(agenda.items.some((i) => i.kind === "search.discover")).toBe(false);
  });

  it("hungry override re-runs the most-overdue idle search when the apply cap has room", async () => {
    const agenda = await service({
      appliedToday: 0,
      // Not due, but never run - re-run it since the pipeline is empty and the cap is unspent.
      pilotSearches: [futureRow({ id: "s-hungry", query: "react", lastRunAt: null })],
    }).refresh("p1");
    expect(agenda.items.find((i) => i.kind === "search.discover")?.subjectId).toBe("s-hungry");
  });

  it("hungry override stays silent once the daily apply cap is spent", async () => {
    const agenda = await service({
      instructionsConfig: { dailyApplyCap: 5 },
      appliedToday: 5,
      pilotSearches: [futureRow({ lastRunAt: null })],
    }).refresh("p1");
    expect(agenda.items.some((i) => i.kind === "search.discover")).toBe(false);
  });
});

describe("AgendaService discover campaign reuse", () => {
  const discoverPayload = (agenda: { items: { kind: string; payload: unknown }[] }) =>
    agenda.items.find((i) => i.kind === "search.discover")?.payload as
      | { campaignId?: string }
      | undefined;

  it("carries the in-progress campaign the search spawned", async () => {
    const agenda = await service({
      pilotSearches: [dueRow({ id: "s1", query: "react" })],
      dueSearchCampaigns: [{ campaignId: "c-old", pilotSearchId: "s1" }],
    }).refresh("p1");
    expect(discoverPayload(agenda)?.campaignId).toBe("c-old");
  });

  it("prefers the newest campaign when the search spawned several", async () => {
    const agenda = await service({
      pilotSearches: [dueRow({ id: "s1", query: "react" })],
      // The gather orders by startedAt asc, so the later row is the newest and wins the overwrite.
      dueSearchCampaigns: [
        { campaignId: "c-old", pilotSearchId: "s1" },
        { campaignId: "c-new", pilotSearchId: "s1" },
      ],
    }).refresh("p1");
    expect(discoverPayload(agenda)?.campaignId).toBe("c-new");
  });

  it("keeps the campaign after the pilot rewrites the search's query", async () => {
    const agenda = await service({
      pilotSearches: [dueRow({ id: "s1", query: "senior react" })],
      // The campaign was opened under the old query; only the id still ties them together.
      dueSearchCampaigns: [{ campaignId: "c-old", pilotSearchId: "s1" }],
    }).refresh("p1");
    expect(discoverPayload(agenda)?.campaignId).toBe("c-old");
  });

  it("omits campaignId when the search has no in-progress campaign", async () => {
    const agenda = await service({ pilotSearches: [dueRow({ query: "react" })] }).refresh("p1");
    const payload = discoverPayload(agenda);
    expect(payload).toBeDefined();
    expect(payload?.campaignId).toBeUndefined();
  });
});

describe("AgendaService discover claim damper", () => {
  it("suppresses a due search with an unreleased discovery claim (in-flight guard)", async () => {
    const agenda = await service({
      pilotSearches: [dueRow({ id: "s-react", query: "react" })],
      searchClaims: [{ subjectId: "s-react", grantedAt: new Date(), releasedAt: null }],
    }).refresh("p1");
    expect(agenda.items.some((i) => i.kind === "search.discover")).toBe(false);
  });
});
