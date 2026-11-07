import type { PilotThreadJob } from "@jobpilot/contracts/pilot";
import type { PilotJournalEntry, PilotRun } from "@/generated/prisma/client";
import { buildThread } from "./thread.service";
import type { DiscoveredJob } from "./thread-work";
import { describe, expect, it } from "bun:test";

const T0 = new Date("2026-11-05T09:00:00Z").getTime();
const at = (minutes: number) => new Date(T0 + minutes * 60_000);

function entry(
  id: string,
  minutes: number,
  over: Partial<PilotJournalEntry> = {},
): PilotJournalEntry {
  return {
    id,
    userId: "u1",
    runId: null,
    kind: "action",
    summary: `entry ${id}`,
    detail: {},
    subjectType: null,
    subjectId: null,
    createdAt: at(minutes),
    ...over,
  };
}

function run(id: string, startMin: number, endMin: number, over: Partial<PilotRun> = {}) {
  return {
    id,
    taskType: "upwork.syncInbox",
    subjectType: "upwork",
    subjectId: "inbox",
    title: "Pull the Upwork inbox",
    outcome: "done",
    startedAt: at(startMin),
    finishedAt: at(endMin),
    payload: {},
    ...over,
  } satisfies Partial<PilotRun>;
}

interface ThreadExtras {
  jobs?: Map<string, PilotThreadJob>;
  discovered?: DiscoveredJob[];
}

function thread(
  entries: PilotJournalEntry[],
  runs: ReturnType<typeof run>[],
  extras: ThreadExtras = {},
) {
  return buildThread({
    entries,
    runs,
    jobs: extras.jobs ?? new Map(),
    discovered: extras.discovered ?? [],
    questions: [],
    changes: [],
    messages: [],
    requests: [],
  });
}

describe("buildThread", () => {
  it("folds a run's entries into one line led by its result summary", () => {
    const items = thread(
      [
        entry("e1", 1, { runId: "r1", kind: "correction", summary: "draft edited" }),
        entry("e2", 2, { runId: "r1", summary: "Refreshed the inbox" }),
      ],
      [run("r1", 0, 3)],
    );
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      type: "work",
      runs: [{ runId: "r1", summary: "Refreshed the inbox", title: "Pull the Upwork inbox" }],
    });
  });

  it("folds runs under 20 minutes apart and splits wider gaps", () => {
    const items = thread(
      [
        entry("a", 5, { runId: "r1" }),
        entry("b", 15, { runId: "r2" }),
        entry("c", 60, { runId: "r3" }),
      ],
      [run("r1", 0, 5), run("r2", 6, 15), run("r3", 50, 60)],
    );
    const work = items.filter((item) => item.type === "work");
    expect(work.map((block) => block.runs.map((line) => line.runId))).toEqual([
      ["r3"],
      ["r1", "r2"],
    ]);
    expect(work[1]).toMatchObject({ startedAt: at(0), endedAt: at(15) });
  });

  it("keeps runless entries as notes and digests, newest first", () => {
    const items = thread(
      [
        entry("n1", 30, { kind: "system", summary: "Host restarted" }),
        entry("d1", 10, { kind: "digest", summary: "Morning summary" }),
      ],
      [],
    );
    expect(items.map((item) => [item.type, item.id])).toEqual([
      ["note", "n1"],
      ["digest", "d1"],
    ]);
  });

  it("totals a sitting's searches and scores and names each applied job", () => {
    const feed = "019a0000-0000-7000-8000-000000000001";
    const jobs = new Map<string, PilotThreadJob>([
      [`${feed}:a`, { title: "ML Engineer", company: "Acme", score: 82 }],
      [`${feed}:b`, { title: "AI Engineer", company: "Globex", score: 55 }],
      [`${feed}:c`, { title: "Data Engineer", company: "Initech", score: null }],
    ]);
    const items = thread(
      [
        entry("s", 5, { runId: "search" }),
        entry("sc", 10, { runId: "score" }),
        entry("ap", 15, { runId: "apply", subjectType: "job", subjectId: `${feed}:a` }),
      ],
      [
        run("search", 0, 5, { taskType: "search.discover", subjectType: "feed", subjectId: feed }),
        run("score", 6, 10, {
          taskType: "feed.score",
          subjectType: "feed",
          subjectId: feed,
          payload: { minScore: 60, entries: [{ key: "a" }, { key: "b" }, { key: "c" }] },
        }),
        run("apply", 11, 15, { taskType: "job.apply" }),
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
    expect(work?.type === "work" && work.runs.at(-1)?.job).toEqual({
      title: "ML Engineer",
      company: "Acme",
      score: 82,
    });
  });
});
