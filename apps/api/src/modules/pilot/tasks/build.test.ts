import { buildTaskList } from "./build";
import {
  base,
  boardDiagnose,
  cfg,
  contact,
  dueQuery,
  findTask,
  followup,
  hotJob,
  job,
  pausedFeed,
  prep,
  question,
  queueScore,
  reply,
  scorePending,
  send,
  setup,
  tune,
} from "./builders";
import { describe, expect, it } from "bun:test";

const NETWORKING_OFF = cfg({ networking: { email: "off", linkedIn: "off" } });
type Built = ReturnType<typeof buildTaskList>;
const taskTypes = (taskList: Built) => taskList.tasks.map((task) => task.taskType);
const countTasks = (taskList: Built, taskType: string) =>
  taskTypes(taskList).filter((type) => type === taskType).length;

describe("buildTaskList ranking", () => {
  it("puts humans and failing boards above any apply, and the rest of the queue below it", () => {
    const taskList = buildTaskList(
      base({
        config: NETWORKING_OFF,
        answeredQuestions: [question("q1")],
        interviewReplies: [reply("em1")],
        boardDiagnoses: [boardDiagnose("linkedin")],
        pausedFeeds: [pausedFeed("c9")],
        approvedJobs: [job("j1", 100)],
        interviewPreps: [prep("app1")],
        queueScores: [queueScore("c8")],
        inbox: { messageIds: ["e1"], count: 1 },
        upworkSync: { lastSyncedAt: null, unreadCount: 0 },
      }),
    );
    expect(taskTypes(taskList)).toEqual([
      "question.answered",
      "interview.reply",
      "board.diagnose",
      "search.review",
      "job.apply",
      "interview.prep",
      "queue.score",
      "inbox.review",
      "upwork.syncInbox",
    ]);
  });

  it("ranks the supporting task types once nothing is left to apply to", () => {
    const taskList = buildTaskList(
      base({
        approvedNetworking: [send("m1")],
        warmIntroCandidates: [hotJob("j1", 90)],
        scorePending: [scorePending("c1")],
        dueQueries: [dueQuery("golang")],
        followups: [followup("f1")],
      }),
    );
    expect(taskTypes(taskList)).toEqual([
      "networking.send",
      "networking.warmIntro",
      "feed.score",
      "search.discover",
      "networking.followup",
    ]);
  });

  it("ranks applies by matchScore and keeps the top 10, with a paused review still on top", () => {
    const jobs = Array.from({ length: 15 }, (_, i) => job(`j${i}`, 80 + i));
    const taskList = buildTaskList(
      base({ config: NETWORKING_OFF, approvedJobs: jobs, pausedFeeds: [pausedFeed("c9")] }),
    );
    expect(taskList.tasks).toHaveLength(10);
    expect(taskList.tasks.map((task) => task.subjectId).slice(0, 3)).toEqual([
      "c9",
      "c1:j14",
      "c1:j13",
    ]);
  });

  it("caps long titles", () => {
    const long = { ...question("q1"), prompt: "x".repeat(500) };
    const taskList = buildTaskList(base({ answeredQuestions: [long] }));
    expect(taskList.tasks[0].title).toHaveLength(200);
  });
});

describe("buildTaskList gating", () => {
  it("stops applying once the daily cap is spent, but still reviews paused feeds", () => {
    const taskList = buildTaskList(
      base({
        config: cfg({ dailyApplyCap: 3, networking: { email: "off", linkedIn: "off" } }),
        appliedToday: 3,
        approvedJobs: [job("j1", 90)],
        pausedFeeds: [pausedFeed("c9")],
      }),
    );
    expect(taskTypes(taskList)).toEqual(["search.review"]);
    expect(taskList.budget).toMatchObject({ dailyApplyCap: 3, appliedToday: 3, capReached: true });
  });

  it("holds scoring and discovery back while approved jobs remain", () => {
    const taskList = buildTaskList(
      base({
        approvedJobs: [job("j1", 80)],
        scorePending: [scorePending("c1")],
        dueQueries: [dueQuery("golang")],
      }),
    );
    expect(taskTypes(taskList)).toEqual(["job.apply"]);
  });

  it("holds setup and feed reviews back until the pipeline is quiet", () => {
    const quietWork = {
      setup,
      feedTunes: [tune("c1")],
      rescanSkipped: [{ feedId: "c1", skippedCount: 9 }],
      retryFailed: [{ feedId: "c1", failedCount: 4 }],
    };
    expect(taskTypes(buildTaskList(base(quietWork)))).toEqual([
      "search.setup",
      "search.tune",
      "job.rescanSkipped",
      "job.retryFailed",
    ]);

    const busyWith = [
      { approvedJobs: [job("j1", 80)] },
      { queueScores: [queueScore("c9")] },
      { dueQueries: [dueQuery("golang")] },
      { scorePending: [scorePending("c2")] },
    ];
    for (const busy of busyWith) {
      const taskList = buildTaskList(base({ ...quietWork, ...busy }));
      expect(taskTypes(taskList)).not.toContain("search.setup");
      expect(taskTypes(taskList)).not.toContain("search.tune");
    }
  });

  it("holds each focused task type to its per-list cap", () => {
    const taskList = buildTaskList(
      base({
        boardDiagnoses: [boardDiagnose("linkedin"), boardDiagnose("indeed")],
        pausedFeeds: [pausedFeed("c1"), pausedFeed("c2")],
        interviewReplies: [reply("e1"), reply("e2"), reply("e3")],
        interviewPreps: [prep("a1"), prep("a2")],
      }),
    );
    expect(countTasks(taskList, "board.diagnose")).toBe(1);
    expect(countTasks(taskList, "search.review")).toBe(1);
    expect(countTasks(taskList, "interview.reply")).toBe(2);
    expect(countTasks(taskList, "interview.prep")).toBe(1);

    const quiet = buildTaskList(
      base({
        warmIntroCandidates: [hotJob("j1", 90), hotJob("j2", 88)],
        followups: [followup("f1"), followup("f2"), followup("f3")],
        feedTunes: [tune("c1"), tune("c2")],
      }),
    );
    expect(countTasks(quiet, "networking.warmIntro")).toBe(1);
    expect(countTasks(quiet, "networking.followup")).toBe(2);
    expect(countTasks(quiet, "search.tune")).toBe(1);
  });
});

describe("buildTaskList networking", () => {
  it("spends the networking cap on sends first, and gives followups what is left", () => {
    const withRoom = buildTaskList(
      base({
        config: cfg({ networking: { dailyCap: 3 } }),
        networkingSentToday: 1,
        approvedNetworking: [send("m1")],
        followups: [followup("f1"), followup("f2")],
      }),
    );
    expect(countTasks(withRoom, "networking.send")).toBe(1);
    expect(countTasks(withRoom, "networking.followup")).toBe(1);

    const spent = buildTaskList(
      base({
        config: cfg({ networking: { dailyCap: 2 } }),
        networkingSentToday: 2,
        approvedNetworking: [send("m1")],
        followups: [followup("f1")],
        warmIntroCandidates: [hotJob("j1", 90)],
      }),
    );
    expect(spent.tasks).toEqual([]);
  });

  it("drops every networking task type when both channels are off, but still triages the inbox", () => {
    const taskList = buildTaskList(
      base({
        config: NETWORKING_OFF,
        warmIntroCandidates: [hotJob("j1", 90)],
        approvedNetworking: [send("m1")],
        followups: [followup("f1")],
        inbox: { messageIds: ["e1"], count: 1 },
      }),
    );
    expect(taskTypes(taskList)).toEqual(["inbox.review"]);
  });

  it("sends email-only work by email, and warm intros by the first channel that is on", () => {
    const bothOn = buildTaskList(
      base({
        config: cfg({ networking: { email: "auto", linkedIn: "review" } }),
        warmIntroCandidates: [hotJob("j1", 90)],
        followups: [followup("f1")],
      }),
    );
    const intro = findTask(bothOn, "networking.warmIntro");
    const followupTask = findTask(bothOn, "networking.followup");
    expect(intro?.payload).toMatchObject({ channel: "email", autonomy: "auto" });
    expect(followupTask?.payload).toMatchObject({ channel: "email", autonomy: "auto" });

    const linkedInOnly = buildTaskList(
      base({
        config: cfg({ networking: { email: "off", linkedIn: "review" } }),
        warmIntroCandidates: [hotJob("j1", 90)],
        approvedNetworking: [send("m1")],
        followups: [followup("f1")],
      }),
    );
    expect(taskTypes(linkedInOnly)).toEqual(["networking.warmIntro"]);
    expect(linkedInOnly.tasks[0].payload).toMatchObject({
      channel: "linkedin",
      autonomy: "review",
    });
  });

  it("carries known insiders on both the apply and the intro, and intros with none", () => {
    const insider = contact("w1");
    const known = hotJob("j1", 90, [insider]);
    const taskList = buildTaskList(base({ approvedJobs: [known], warmIntroCandidates: [known] }));
    const apply = findTask(taskList, "job.apply");
    const intro = findTask(taskList, "networking.warmIntro");
    expect(apply?.payload).toMatchObject({ warmContacts: [insider] });
    expect(intro?.payload).toMatchObject({ contacts: [insider] });

    const unknown = buildTaskList(base({ warmIntroCandidates: [hotJob("j2", 90)] }));
    expect(unknown.tasks[0].payload).toMatchObject({ contacts: [] });
  });
});

describe("buildTaskList discovery", () => {
  it("rotates an unpinned search across the configured boards, and keeps a pinned one", () => {
    const boardAt = (cycleCount: number, ownBoard: string | undefined) =>
      buildTaskList(
        base({
          config: cfg({ boards: ["hiring.cafe", "linkedin.com", "indeed.com"] }),
          cycleCount,
          dueQueries: [dueQuery("golang", ownBoard)],
        }),
      ).tasks[0].payload;

    expect([0, 1, 2, 3].map((cycle) => boardAt(cycle, undefined))).toMatchObject([
      { board: "hiring.cafe" },
      { board: "linkedin.com" },
      { board: "indeed.com" },
      { board: "hiring.cafe" },
    ]);
    expect(boardAt(1, "wellfound")).toMatchObject({ board: "wellfound", maxPages: 5 });
  });
});

describe("buildTaskList empty reason and sleep", () => {
  it("names why an empty task list is empty", () => {
    expect(buildTaskList(base({ approvedJobs: [job("j1", 80)] })).emptyReason).toBeNull();
    expect(buildTaskList(base({ config: cfg({ dailyApplyCap: 0 }) })).emptyReason).toBe(
      "capReached",
    );
    expect(buildTaskList(base({ awaitingSetup: true })).emptyReason).toBe("awaitingSetup");
    expect(buildTaskList(base({ awaitingSetup: false })).emptyReason).toBe("clear");
  });

  it("sleeps briefly with work queued, and otherwise until the check interval", () => {
    expect(buildTaskList(base({ approvedJobs: [job("j1", 80)] })).sleepSeconds).toBe(15);

    const idle = buildTaskList(base({ config: cfg({ checkIntervalMinutes: 30 }) }));
    expect(idle.sleepSeconds).toBe(1800);
    expect(idle.nextWakeAt).toEqual(new Date(idle.builtAt.getTime() + 1800 * 1000));
  });

  it("wakes for the next search due, but never sooner than the floor", () => {
    const sleepUntil = (minutes: number) =>
      buildTaskList(
        base({
          config: cfg({ checkIntervalMinutes: 30 }),
          nextSearchRunAt: new Date(base().now.getTime() + minutes * 60 * 1000),
        }),
      ).sleepSeconds;
    expect(sleepUntil(5)).toBe(300);
    expect(sleepUntil(-1)).toBe(30);
  });
});
