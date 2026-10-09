import { findTask, hasTaskType } from "./builders";
import { service, serviceWithRec } from "./fakes";
import { INBOX_SYNC_STALE_MS } from "./task-list.service";
import { describe, expect, it } from "bun:test";

describe("TaskListService answered questions", () => {
  const answered = {
    id: "E1",
    kind: "approval",
    prompt: "Send this reply?",
    subjectType: "email",
    subjectId: "em1",
    answer: "yes",
    writeForMe: false,
  };

  it("hands the worker the question, its subject and the answer", async () => {
    const taskList = await service({ answered: [answered] }).refresh("p1");
    const task = findTask(taskList, "question.answered");
    expect(task?.payload).toEqual({
      questionId: "E1",
      questionKind: "approval",
      subjectType: "email",
      subjectId: "em1",
      prompt: "Send this reply?",
      answer: "yes",
      writeForMe: false,
    });
  });

  it("drops a question once a run has consumed it", async () => {
    const taskList = await service({
      answered: [answered],
      questionRuns: [{ subjectId: "E1" }],
    }).refresh("p1");
    expect(hasTaskType(taskList, "question.answered")).toBe(false);
  });
});

describe("TaskListService interviews", () => {
  const replyApp = (emailMessages: Record<string, unknown>[]) => ({
    id: "app1",
    company: "Acme",
    title: "Engineer",
    emailMessages,
  });
  const invite = {
    id: "em1",
    threadId: "t1",
    fromAddress: "dana@acme.test",
    subject: "Re: interview",
    receivedAt: new Date("2026-07-14T12:00:00.000Z"),
  };

  it("offers a reply to an interview email, unless one is drafted or approved", async () => {
    const taskList = await service({ interviewReplyApps: [replyApp([invite])] }).refresh("p1");
    const task = findTask(taskList, "interview.reply");
    expect(task?.payload).toMatchObject({ applicationId: "app1", emailMessageId: "em1" });

    const handled = await service({
      interviewReplyApps: [replyApp([invite])],
      interviewQuestions: [{ subjectId: "em1" }],
    }).refresh("p1");
    expect(hasTaskType(handled, "interview.reply")).toBe(false);

    const noEmail = await service({ interviewReplyApps: [replyApp([])] }).refresh("p1");
    expect(hasTaskType(noEmail, "interview.reply")).toBe(false);
  });

  it("preps with the campaign's resume, or none without a campaign", async () => {
    const resumeId = "3f0e1a9c-2b4d-4c8e-9f1a-5b6c7d8e9f0a";
    const app = { id: "app1", company: "Acme", title: "Engineer", url: "https://x/1" };
    const taskList = await service({
      interviewPrepApps: [{ ...app, campaign: { config: { resumeId } } }],
    }).refresh("p1");
    const task = findTask(taskList, "interview.prep");
    expect(task?.payload).toMatchObject({ applicationId: "app1", resumeId });

    const orphan = await service({
      interviewPrepApps: [{ ...app, campaign: null }],
    }).refresh("p1");
    expect(findTask(orphan, "interview.prep")?.payload).toMatchObject({
      resumeId: null,
    });
  });
});

describe("TaskListService mail and Upwork sync", () => {
  it("pulls mail once per refresh, throttled, before reading the inbox", async () => {
    const { svc, rec } = serviceWithRec();
    await svc.refresh("p1");
    expect(rec.inboxSyncs).toEqual([{ userId: "p1", staleMs: INBOX_SYNC_STALE_MS }]);
  });

  it("offers an Upwork pull only to Upwork users, and only once the mirror is stale", async () => {
    const hour = 60 * 60 * 1000;
    const first = await service({ upworkProfiles: 1 }).refresh("p1");
    expect(findTask(first, "upwork.syncInbox")?.title).toBe("Pull the Upwork inbox");

    const stale = await service({
      upworkProfiles: 1,
      upworkUnread: 3,
      upworkAccount: { lastSyncedAt: new Date(Date.now() - 7 * hour) },
    }).refresh("p1");
    const task = findTask(stale, "upwork.syncInbox");
    expect(task?.title).toBe("Refresh the Upwork inbox");
    expect(task?.payload).toMatchObject({ unreadCount: 3 });

    const quiet = [
      {},
      { upworkProfiles: 1, upworkAccount: { lastSyncedAt: new Date(Date.now() - hour) } },
      // An unconnected MCP only journals "not connected", so a recent try holds it back.
      {
        upworkProfiles: 1,
        upworkSyncRun: { startedAt: new Date(), finishedAt: new Date(), outcome: "done" },
      },
    ];
    for (const over of quiet) {
      expect(hasTaskType(await service(over).refresh("p1"), "upwork.syncInbox")).toBe(false);
    }
  });
});
