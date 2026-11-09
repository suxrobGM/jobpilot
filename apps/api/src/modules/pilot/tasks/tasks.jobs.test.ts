import { findTask, hasTaskType } from "./builders";
import { approvedJob, service } from "./fakes";
import { describe, expect, it } from "bun:test";

describe("TaskListService warm intros", () => {
  const insider = {
    id: "ct1",
    name: "Insider",
    title: "Staff Eng",
    email: "in@acme.test",
    company: "Acme, Inc.",
  };

  it("matches contacts by normalized company onto both the apply and the intro", async () => {
    const taskList = await service({
      approvedJobs: [approvedJob({ matchScore: 90, company: "Acme" })],
      contacts: [insider],
    }).refresh("p1");
    const apply = findTask(taskList, "job.apply");
    const intro = findTask(taskList, "networking.warmIntro");
    expect(apply?.payload).toMatchObject({ warmContacts: [{ id: "ct1" }] });
    expect(intro?.payload).toMatchObject({ contacts: [{ id: "ct1" }] });
  });

  it("leaves a job below the score floor out of the pool", async () => {
    const taskList = await service({
      approvedJobs: [approvedJob({ matchScore: 79 })],
      contacts: [insider],
    }).refresh("p1");
    expect(hasTaskType(taskList, "networking.warmIntro")).toBe(false);
  });

  it("keeps a recent strong apply in the pool", async () => {
    const taskList = await service({
      recentAppliedJobs: [approvedJob({ matchScore: 90, key: "done1" })],
    }).refresh("p1");
    const intro = findTask(taskList, "networking.warmIntro");
    expect(intro?.subjectId).toBe("c1:done1");
  });

  it("drops an introduced job from the pool but keeps its contacts on the apply", async () => {
    const taskList = await service({
      approvedJobs: [approvedJob({ matchScore: 90, key: "j1" })],
      runs: {
        "networking.warmIntro": [
          { subjectId: "c1:j1", startedAt: new Date(), finishedAt: new Date(), outcome: "done" },
        ],
      },
      contacts: [insider],
    }).refresh("p1");
    expect(hasTaskType(taskList, "networking.warmIntro")).toBe(false);
    const apply = findTask(taskList, "job.apply");
    expect(apply?.payload).toMatchObject({ warmContacts: [{ id: "ct1" }] });
  });
});

describe("TaskListService board.diagnose", () => {
  // Newest-first apply outcomes for one board.
  const failed = (key: string, live = true) => ({
    feedId: "c1",
    key,
    url: `https://x/${key}`,
    board: { id: "b-linkedin", domain: "linkedin.com" },
    status: "failed",
    failReason: "captcha wall",
    feed: { pausedAt: live ? null : new Date(), archivedAt: null },
  });
  const applied = (key: string) => ({ ...failed(key), status: "applied", failReason: null });

  it("flags a board whose latest three applies failed, probing the newest retryable failure", async () => {
    const taskList = await service({
      boardDiagnoseJobs: [failed("a", false), failed("b"), failed("c"), applied("d")],
    }).refresh("p1");
    const task = findTask(taskList, "board.diagnose");
    expect(task?.payload).toEqual({
      boardId: "b-linkedin",
      board: "linkedin.com",
      consecutiveFailures: 3,
      recentFailReasons: ["captcha wall", "captcha wall", "captcha wall"],
      testJob: { feedId: "c1", jobKey: "b", url: "https://x/b" },
    });
  });

  it("offers no test job when every failure sits in a paused feed", async () => {
    const taskList = await service({
      boardDiagnoseJobs: ["a", "b", "c"].map((key) => failed(key, false)),
    }).refresh("p1");
    expect(findTask(taskList, "board.diagnose")?.payload).toMatchObject({ testJob: null });
  });

  it("waits a day before diagnosing the same board again", async () => {
    const taskList = await service({
      boardDiagnoseJobs: [failed("a"), failed("b"), failed("c")],
      runs: {
        "board.diagnose": [
          {
            subjectId: "b-linkedin",
            startedAt: new Date(),
            finishedAt: new Date(),
            outcome: "done",
          },
        ],
      },
    }).refresh("p1");
    expect(hasTaskType(taskList, "board.diagnose")).toBe(false);
  });

  it("does not flag a board whose streak a recent success broke", async () => {
    const taskList = await service({
      boardDiagnoseJobs: [failed("a"), failed("b"), applied("c"), failed("d")],
    }).refresh("p1");
    expect(hasTaskType(taskList, "board.diagnose")).toBe(false);
  });
});
