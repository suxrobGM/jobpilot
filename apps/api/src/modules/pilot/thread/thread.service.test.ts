import type { PilotThreadJob } from "@jobpilot/contracts/pilot";
import type { PilotRun } from "@/generated/prisma/client";
import { buildThread } from "./thread.service";
import type { DiscoveredJob, ThreadJob } from "./thread-work";
import { describe, expect, it } from "bun:test";

const T0 = new Date("2026-11-05T09:00:00Z").getTime();
const at = (minutes: number) => new Date(T0 + minutes * 60_000);

function run(id: string, startMin: number, endMin: number, over: Partial<PilotRun> = {}) {
  return {
    id,
    taskType: "upwork.syncInbox",
    subjectType: "upwork",
    subjectId: "inbox",
    title: "Pull the Upwork inbox",
    summary: `run ${id}`,
    outcome: "done",
    startedAt: at(startMin),
    finishedAt: at(endMin),
    payload: {},
    ...over,
  } satisfies Partial<PilotRun>;
}

function threadJob(over: Partial<PilotThreadJob>, appliedAt: Date | null = null): ThreadJob {
  return {
    job: {
      id: crypto.randomUUID(),
      title: "ML Engineer",
      company: "Acme",
      score: null,
      status: "approved",
      applicationId: null,
      ...over,
    },
    appliedAt,
  };
}

interface ThreadExtras {
  jobs?: Map<string, ThreadJob>;
  questionJobs?: Map<string, string>;
  discovered?: DiscoveredJob[];
}

function thread(runs: ReturnType<typeof run>[], extras: ThreadExtras = {}) {
  return buildThread({
    runs,
    questionJobs: extras.questionJobs ?? new Map(),
    jobs: extras.jobs ?? new Map(),
    discovered: extras.discovered ?? [],
    questions: [],
    changes: [],
    messages: [],
    requests: [],
  });
}

describe("buildThread", () => {
  it("shows each run as a line led by its result summary", () => {
    const items = thread([run("r1", 0, 3, { summary: "Refreshed the inbox" })]);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      type: "work",
      runs: [{ runId: "r1", summary: "Refreshed the inbox", title: "Pull the Upwork inbox" }],
    });
  });

  it("folds runs under 20 minutes apart and splits wider gaps", () => {
    const items = thread([run("r1", 0, 5), run("r2", 6, 15), run("r3", 50, 60)]);
    const work = items.filter((item) => item.type === "work");
    expect(work.map((block) => block.runs.map((line) => line.runId))).toEqual([
      ["r3"],
      ["r1", "r2"],
    ]);
    expect(work[1]).toMatchObject({ startedAt: at(0), endedAt: at(15) });
  });

  it("links an answer's run to the job its question was about", () => {
    const job = "019a0000-0000-7000-8000-000000000001:a";
    const items = thread(
      [
        run("r1", 0, 3, {
          taskType: "question.answered",
          subjectType: "question",
          subjectId: "q1",
        }),
      ],
      {
        questionJobs: new Map([["q1", job]]),
        jobs: new Map([[job, threadJob({ company: "Acme" })]]),
      },
    );
    expect(items[0]).toMatchObject({
      runs: [{ subjectType: "job", subjectId: job, job: { company: "Acme" } }],
    });
  });

  it("totals a sitting's searches and scores and names each applied job", () => {
    const feed = "019a0000-0000-7000-8000-000000000001";
    const jobs = new Map([
      [`${feed}:a`, threadJob({ title: "ML Engineer", company: "Acme", score: 82 })],
      [`${feed}:b`, threadJob({ title: "AI Engineer", company: "Globex", score: 55 })],
      [`${feed}:c`, threadJob({ title: "Data Engineer", company: "Initech", score: null })],
    ]);
    const items = thread(
      [
        run("search", 0, 5, { taskType: "search.discover", subjectType: "feed", subjectId: feed }),
        run("score", 6, 10, {
          taskType: "feed.score",
          subjectType: "feed",
          subjectId: feed,
          payload: { minScore: 60, entries: [{ key: "a" }, { key: "b" }, { key: "c" }] },
        }),
        run("apply", 11, 15, {
          taskType: "job.apply",
          subjectType: "job",
          subjectId: `${feed}:a`,
        }),
      ],
      {
        jobs,
        // The last one was created after the search run ended, so it isn't counted.
        discovered: [at(2), at(4), at(30)].map((createdAt) => ({ feedId: feed, createdAt })),
      },
    );
    const work = items.find((item) => item.type === "work");
    expect(work).toMatchObject({
      searchTally: {
        searches: 1,
        newJobs: 2,
        scored: 2,
        passed: 1,
        best: { company: "Acme", score: 82 },
      },
    });
    expect(work?.type === "work" && work.runs.at(-1)?.job).toMatchObject({
      title: "ML Engineer",
      company: "Acme",
      score: 82,
    });
  });

  it("calls a run applied only when the application landed during it", () => {
    const subject = "019a0000-0000-7000-8000-000000000001:g";
    const apply = { taskType: "job.apply", subjectType: "job" as const, subjectId: subject };
    // Skipped at the first try, then applied on a later run.
    const jobs = new Map([[subject, threadJob({ status: "applied" }, at(62))]]);
    const items = thread([run("skip", 0, 5, apply), run("apply", 60, 65, apply)], { jobs });
    const lines = items.flatMap((item) => (item.type === "work" ? item.runs : []));
    expect(lines.map((line) => [line.runId, line.applied])).toEqual([
      ["apply", true],
      ["skip", false],
    ]);
  });
});
