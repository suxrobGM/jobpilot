import type { TaskType } from "@jobpilot/contracts/pilot";
import { findTask, hasTaskType } from "./builders";
import { service, serviceWithRec } from "./fakes";
import { describe, expect, it } from "bun:test";

describe("TaskListService campaign.scorePending", () => {
  const campaign = {
    id: "c1",
    query: "react",
    config: { minScore: 70 },
    board: { domain: "linkedin.com" },
    _count: { jobs: 9 },
    jobs: [{ key: "j1", url: "https://x/j1", title: "Engineer" }],
  };

  it("offers a campaign's unscored rows with its own board and threshold", async () => {
    const taskList = await service({ scorePendingCampaigns: [campaign] }).refresh("p1");
    const task = findTask(taskList, "campaign.scorePending");
    expect(task?.subjectId).toBe("c1");
    expect(task?.payload).toMatchObject({ board: "linkedin.com", minScore: 70, pendingCount: 9 });
  });

  // An unscorable row stays pending forever and outranks discovery, so a recent run must hold it back.
  it("holds a campaign back while its last run is recent", async () => {
    const taskList = await service({
      scorePendingCampaigns: [campaign],
      runs: {
        "campaign.scorePending": [
          { subjectId: "c1", startedAt: new Date(), finishedAt: new Date() },
        ],
      },
    }).refresh("p1");
    expect(hasTaskType(taskList, "campaign.scorePending")).toBe(false);
  });
});

describe("TaskListService campaign.reviewPaused", () => {
  const pausedAt = new Date(Date.now() - 60 * 60_000);
  const paused = { id: "c9", query: "react", config: {}, updatedAt: pausedAt };
  const answeredAt = (offsetMs: number) => new Date(pausedAt.getTime() + offsetMs);

  it("offers a paused auto-apply campaign for review", async () => {
    const taskList = await service({ pausedCampaigns: [paused] }).refresh("p1");
    const task = findTask(taskList, "campaign.reviewPaused");
    expect(task?.payload).toEqual({ campaignId: "c9", query: "react", board: null, pausedAt });
  });

  it("waits while the user has an open question or answered this pause", async () => {
    const open = await service({
      pausedCampaigns: [paused],
      campaignQuestions: [{ subjectId: "c9", status: "open", answeredAt: null }],
    }).refresh("p1");
    expect(hasTaskType(open, "campaign.reviewPaused")).toBe(false);

    const decided = await service({
      pausedCampaigns: [paused],
      campaignQuestions: [{ subjectId: "c9", status: "answered", answeredAt: answeredAt(60_000) }],
    }).refresh("p1");
    expect(hasTaskType(decided, "campaign.reviewPaused")).toBe(false);
  });

  it("asks again when the only answer predates the current pause", async () => {
    const taskList = await service({
      pausedCampaigns: [paused],
      campaignQuestions: [{ subjectId: "c9", status: "answered", answeredAt: answeredAt(-60_000) }],
    }).refresh("p1");
    expect(hasTaskType(taskList, "campaign.reviewPaused")).toBe(true);
  });

  it("holds a campaign back while its last review is recent", async () => {
    const taskList = await service({
      pausedCampaigns: [paused],
      runs: {
        "campaign.reviewPaused": [{ subjectId: "c9", startedAt: new Date(), finishedAt: null }],
      },
    }).refresh("p1");
    expect(hasTaskType(taskList, "campaign.reviewPaused")).toBe(false);
  });
});

describe("TaskListService queue.score", () => {
  const RESUME_ID = "b0f1c2d3-4e5a-4b6c-8d7e-9f0a1b2c3d4e";
  const queued = {
    id: "c1",
    config: { resumeId: RESUME_ID, minScore: 55 },
    _count: { jobs: 3 },
    jobs: [{ key: "q1", url: "https://x/1" }],
  };

  it("offers one batch per apply campaign holding pasted links", async () => {
    const taskList = await service({ queuedCampaigns: [queued] }).refresh("p1");
    const task = findTask(taskList, "queue.score");
    expect(task?.payload).toEqual({
      campaignId: "c1",
      resumeId: RESUME_ID,
      minScore: 55,
      queuedCount: 3,
      entries: [{ key: "q1", url: "https://x/1" }],
    });
  });

  it("holds a campaign back while its last scoring run is still open", async () => {
    const taskList = await service({
      queuedCampaigns: [queued],
      runs: { "queue.score": [{ subjectId: "c1", startedAt: new Date(), finishedAt: null }] },
    }).refresh("p1");
    expect(hasTaskType(taskList, "queue.score")).toBe(false);
  });
});

describe("TaskListService campaign reviews", () => {
  // 40 found, 4 qualified, 36 skipped, 3 failed: past every review threshold.
  const laggard = {
    quietCampaigns: [
      {
        id: "c1",
        query: "react",
        config: { minScore: 70 },
        board: { domain: "linkedin.com" },
        source: "search",
      },
    ],
    quietJobCounts: [
      { campaignId: "c1", status: "applied", _count: { _all: 1 } },
      { campaignId: "c1", status: "skipped", _count: { _all: 36 } },
      { campaignId: "c1", status: "failed", _count: { _all: 3 } },
    ],
  };

  it("offers a tune, a rescan and a retry for a poorly converting campaign", async () => {
    const taskList = await service({
      ...laggard,
      skipReasonRows: [{ campaignId: "c1", skipReason: "overqualified", _count: { _all: 20 } }],
    }).refresh("p1");
    const taskPayload = (taskType: TaskType) => findTask(taskList, taskType)?.payload;
    expect(taskPayload("campaign.tune")).toMatchObject({
      config: { minScore: 70, board: "linkedin.com" },
      counts: { totalFound: 40, qualified: 4, applied: 1, skipped: 36 },
      topSkipReasons: ["overqualified"],
    });
    expect(taskPayload("job.rescanSkipped")).toMatchObject({ skippedCount: 36 });
    expect(taskPayload("job.retryFailed")).toMatchObject({ failedCount: 3 });
  });

  it("skips a review that ran for the same campaign this week", async () => {
    const taskList = await service({
      ...laggard,
      runs: {
        "campaign.tune": [
          { subjectId: "c1", startedAt: new Date(), finishedAt: new Date(), outcome: "done" },
        ],
        "job.rescanSkipped": [
          { subjectId: "c1", startedAt: new Date(), finishedAt: new Date(), outcome: "done" },
        ],
        "job.retryFailed": [{ subjectId: "other", startedAt: new Date(), finishedAt: new Date() }],
      },
    }).refresh("p1");
    expect(hasTaskType(taskList, "campaign.tune")).toBe(false);
    expect(hasTaskType(taskList, "job.rescanSkipped")).toBe(false);
    expect(hasTaskType(taskList, "job.retryFailed")).toBe(true);
  });
});

describe("TaskListService idle-campaign sweep", () => {
  it("completes an idle campaign server-side and journals it, with no task", async () => {
    const { svc, rec } = serviceWithRec({
      finalizeCampaigns: [{ id: "c3", query: "react" }],
    });
    const taskList = await svc.refresh("p1");
    expect(rec.campaignUpdates).toHaveLength(1);
    expect(rec.campaignUpdates[0]).toMatchObject({
      where: { id: { in: ["c3"] }, status: "in_progress" },
      data: { status: "completed", statusChangedBy: "pilot" },
    });
    expect(rec.journals).toContainEqual(
      expect.objectContaining({ kind: "action", subjectType: "campaign", subjectId: "c3" }),
    );
    expect(taskList.tasks.some((task) => task.subjectId === "c3")).toBe(false);
  });
});
