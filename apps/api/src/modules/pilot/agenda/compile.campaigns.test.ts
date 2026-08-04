// Campaign-level gathers through AgendaService.refresh (fake Prisma, no DB): score-pending
// backlogs and the paused-campaign review.

import { service, serviceWithRec } from "./compile.test-helpers";
import { describe, expect, it } from "bun:test";

describe("AgendaService campaign.scorePending", () => {
  it("emits scorePending for an auto-apply campaign with unscored pending rows", async () => {
    const agenda = await service({
      scorePendingCampaigns: [
        {
          campaignId: "c1",
          query: "react",
          config: { board: "linkedin", minScore: 70 },
          jobs: [{ key: "j1", url: "https://x/j1", title: "Engineer" }],
        },
      ],
      scorePendingCounts: [{ campaignId: "c1", _count: { _all: 9 } }],
    }).refresh("p1");
    const item = agenda.items.find((i) => i.kind === "campaign.scorePending");
    expect(item?.subjectType).toBe("campaign");
    expect(item?.subjectId).toBe("c1");
    expect(item?.payload).toMatchObject({
      campaignId: "c1",
      board: "linkedin",
      minScore: 70,
      pendingCount: 9,
      entries: [{ key: "j1", url: "https://x/j1", title: "Engineer" }],
    });
  });

  // An unscorable row keeps matchScore null forever, and scorePending outranks discovery - the
  // cooldown is what stops one such row from starving discovery on every cycle.
  const scorePendingOver = {
    scorePendingCampaigns: [
      {
        campaignId: "c1",
        query: "react",
        config: {},
        jobs: [{ key: "j1", url: "https://x/j1", title: "Engineer" }],
      },
    ],
    scorePendingCounts: [{ campaignId: "c1", _count: { _all: 4 } }],
  };

  it("suppresses scorePending while its previous claim is still open", async () => {
    const agenda = await service({
      ...scorePendingOver,
      scorePendingClaims: [{ subjectId: "c1", grantedAt: new Date(), releasedAt: null }],
    }).refresh("p1");
    expect(agenda.items.some((i) => i.kind === "campaign.scorePending")).toBe(false);
  });

  it("suppresses scorePending inside the cooldown after the last run released", async () => {
    const agenda = await service({
      ...scorePendingOver,
      scorePendingClaims: [
        {
          subjectId: "c1",
          grantedAt: new Date(Date.now() - 20 * 60_000),
          releasedAt: new Date(Date.now() - 10 * 60_000),
        },
      ],
    }).refresh("p1");
    expect(agenda.items.some((i) => i.kind === "campaign.scorePending")).toBe(false);
  });

  it("re-emits scorePending once the cooldown has elapsed", async () => {
    const agenda = await service({
      ...scorePendingOver,
      scorePendingClaims: [
        {
          subjectId: "c1",
          grantedAt: new Date(Date.now() - 5 * 60 * 60_000),
          releasedAt: new Date(Date.now() - 4 * 60 * 60_000),
        },
      ],
    }).refresh("p1");
    expect(agenda.items.some((i) => i.kind === "campaign.scorePending")).toBe(true);
  });

  // Gate on matchScore alone and a row scored off the results page never gains a digest.
  it("claims rows missing either a score or a digest", async () => {
    const { svc, rec } = serviceWithRec(scorePendingOver);
    await svc.refresh("p1");

    // Finalize and queue-drain filter `jobs` too; only score-pending pins source auto_apply.
    const gather = rec.campaignQueries.find(
      (w) => "jobs" in w && w.source === "auto_apply" && !("OR" in w),
    ) as { jobs: { some: Record<string, unknown> } };
    expect(gather.jobs.some).toMatchObject({
      status: "pending",
      OR: [{ matchScore: null }, { digest: null }],
    });
  });
});

describe("AgendaService campaign.reviewPaused", () => {
  const pausedAt = new Date(Date.now() - 60 * 60_000);
  const paused = (over: Record<string, unknown> = {}) => ({
    campaignId: "c9",
    query: "react",
    config: {},
    updatedAt: pausedAt,
    ...over,
  });

  it("emits a review item for a paused auto-apply campaign", async () => {
    const agenda = await service({ pausedCampaigns: [paused()] }).refresh("p1");
    const item = agenda.items.find((i) => i.kind === "campaign.reviewPaused");
    expect(item?.subjectType).toBe("campaign");
    expect(item?.subjectId).toBe("c9");
    expect(item?.payload).toEqual({ campaignId: "c9", query: "react", board: null, pausedAt });
  });

  it("suppresses the review while a campaign question is open (user has the ball)", async () => {
    const agenda = await service({
      pausedCampaigns: [paused()],
      campaignQuestions: [{ subjectId: "c9", status: "open", answeredAt: null }],
    }).refresh("p1");
    expect(agenda.items.some((i) => i.kind === "campaign.reviewPaused")).toBe(false);
  });

  it("suppresses the review after a keep-paused answer for the current pause episode", async () => {
    const agenda = await service({
      pausedCampaigns: [paused()],
      campaignQuestions: [
        { subjectId: "c9", status: "answered", answeredAt: new Date(pausedAt.getTime() + 60_000) },
      ],
    }).refresh("p1");
    expect(agenda.items.some((i) => i.kind === "campaign.reviewPaused")).toBe(false);
  });

  it("re-emits after a re-pause makes the old answer stale (previous episode)", async () => {
    const agenda = await service({
      pausedCampaigns: [paused()],
      campaignQuestions: [
        { subjectId: "c9", status: "answered", answeredAt: new Date(pausedAt.getTime() - 60_000) },
      ],
    }).refresh("p1");
    expect(agenda.items.some((i) => i.kind === "campaign.reviewPaused")).toBe(true);
  });

  it("suppresses the review while a review claim is open or released within a day", async () => {
    const open = await service({
      pausedCampaigns: [paused()],
      pausedReviewClaims: [{ subjectId: "c9", grantedAt: new Date(), releasedAt: null }],
    }).refresh("p1");
    expect(open.items.some((i) => i.kind === "campaign.reviewPaused")).toBe(false);

    const recent = await service({
      pausedCampaigns: [paused()],
      pausedReviewClaims: [
        { subjectId: "c9", grantedAt: new Date(), releasedAt: new Date(Date.now() - 60 * 60_000) },
      ],
    }).refresh("p1");
    expect(recent.items.some((i) => i.kind === "campaign.reviewPaused")).toBe(false);
  });

  it("re-emits once the claim damper has elapsed (released >24h ago)", async () => {
    const agenda = await service({
      pausedCampaigns: [paused()],
      pausedReviewClaims: [
        {
          subjectId: "c9",
          grantedAt: new Date(Date.now() - 26 * 60 * 60_000),
          releasedAt: new Date(Date.now() - 25 * 60 * 60_000),
        },
      ],
    }).refresh("p1");
    expect(agenda.items.some((i) => i.kind === "campaign.reviewPaused")).toBe(true);
  });

  // Crash recovery (expired/abandoned) caps the 24h damper at CRASH_RETRY_MS (2h), unlike a deliberate outcome.
  it("re-emits a crash-recovered (expired) review after 2h despite the 24h damper", async () => {
    const agenda = await service({
      pausedCampaigns: [paused()],
      pausedReviewClaims: [
        {
          subjectId: "c9",
          grantedAt: new Date(Date.now() - 4 * 60 * 60_000),
          releasedAt: new Date(Date.now() - 3 * 60 * 60_000),
          outcome: "expired",
        },
      ],
    }).refresh("p1");
    expect(agenda.items.some((i) => i.kind === "campaign.reviewPaused")).toBe(true);
  });

  it("keeps damping a deliberately-closed (done) review inside the 24h window", async () => {
    const agenda = await service({
      pausedCampaigns: [paused()],
      pausedReviewClaims: [
        {
          subjectId: "c9",
          grantedAt: new Date(Date.now() - 4 * 60 * 60_000),
          releasedAt: new Date(Date.now() - 3 * 60 * 60_000),
          outcome: "done",
        },
      ],
    }).refresh("p1");
    expect(agenda.items.some((i) => i.kind === "campaign.reviewPaused")).toBe(false);
  });
});

describe("AgendaService idle-campaign finalize sweep", () => {
  it("completes idle campaigns server-side, journals each, and emits no agenda item", async () => {
    const { svc, rec } = serviceWithRec({
      finalizeCampaigns: [{ campaignId: "c3", query: "react" }],
    });
    const agenda = await svc.refresh("p1");
    expect(rec.campaignUpdates).toHaveLength(1);
    expect(rec.campaignUpdates[0].where).toMatchObject({ campaignId: "c3", status: "in_progress" });
    expect(rec.campaignUpdates[0].data).toMatchObject({
      status: "completed",
      statusActor: "pilot",
    });
    const journal = rec.journals.find((j) => j.kind === "action");
    expect(journal).toMatchObject({ subjectType: "campaign", subjectId: "c3" });
    expect(agenda.items.some((i) => i.subjectId === "c3")).toBe(false);
  });

  it("writes nothing when no campaign is idle", async () => {
    const { svc, rec } = serviceWithRec();
    await svc.refresh("p1");
    expect(rec.campaignUpdates).toHaveLength(0);
  });
});
