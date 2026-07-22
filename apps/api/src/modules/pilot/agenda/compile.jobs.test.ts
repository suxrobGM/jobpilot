// Apply-pipeline gathers through AgendaService.refresh (fake Prisma, no DB): the warm-check
// contact join and parked-board enforcement.

import { service } from "./compile.test-helpers";
import { approvedJob, pilotSearchRow } from "./db.test-helpers";
import { describe, expect, it } from "bun:test";

const HOUR = 60 * 60 * 1000;
const dueRow = (over: Record<string, unknown> = {}) =>
  pilotSearchRow({ nextRunAt: new Date(Date.now() - HOUR), ...over });
const futureRow = (over: Record<string, unknown> = {}) =>
  pilotSearchRow({ nextRunAt: new Date(Date.now() + HOUR), ...over });

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
      approvedJobs: [approvedJob({ matchScore: 84, company: "Acme" })],
      contacts: [insider],
    }).refresh("p1");
    expect(agenda.items.some((i) => i.kind === "networking.warmIntro")).toBe(false);
  });
});

describe("AgendaService parkedBoards enforcement", () => {
  it("excludes approved jobs on a parked board from job.apply", async () => {
    const agenda = await service({
      instructionsConfig: { parkedBoards: ["linkedin"] },
      approvedJobs: [
        approvedJob({ key: "on-parked", board: "linkedin" }),
        approvedJob({ key: "on-live", board: "indeed" }),
      ],
    }).refresh("p1");
    const applyKeys = agenda.items.filter((i) => i.kind === "job.apply").map((i) => i.subjectId);
    expect(applyKeys).toEqual(["on-live"]);
  });

  it("excludes searches on a parked board from search.discover", async () => {
    const agenda = await service({
      instructionsConfig: { parkedBoards: ["linkedin"] },
      pilotSearches: [
        dueRow({ id: "s-react", query: "react", board: "linkedin" }),
        dueRow({ id: "s-go", query: "golang", board: "indeed" }),
      ],
    }).refresh("p1");
    const discovered = agenda.items
      .filter((i) => i.kind === "search.discover")
      .map((i) => (i.payload as { query: string }).query);
    expect(discovered).toEqual(["golang"]);
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

  it("hungry override re-runs the most-overdue idle search when apply headroom remains", async () => {
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

  it("carries the existing in-progress campaign for the query", async () => {
    const agenda = await service({
      pilotSearches: [dueRow({ query: "react" })],
      dueQueryCampaigns: [{ campaignId: "c-old", query: "react" }],
    }).refresh("p1");
    expect(discoverPayload(agenda)?.campaignId).toBe("c-old");
  });

  it("prefers the newest campaign when several match the query", async () => {
    const agenda = await service({
      pilotSearches: [dueRow({ query: "react" })],
      // The gather orders by startedAt asc, so the later row is the newest and wins the overwrite.
      dueQueryCampaigns: [
        { campaignId: "c-old", query: "react" },
        { campaignId: "c-new", query: "react" },
      ],
    }).refresh("p1");
    expect(discoverPayload(agenda)?.campaignId).toBe("c-new");
  });

  it("omits campaignId when no in-progress campaign matches", async () => {
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
