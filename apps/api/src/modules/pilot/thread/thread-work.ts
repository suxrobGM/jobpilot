import type {
  PilotThreadItem,
  PilotThreadJob,
  PilotThreadRun,
  PilotThreadSearchTally,
} from "@jobpilot/contracts/pilot";
import { z } from "zod/v4";
import type { PilotRun as PilotRunModel } from "@/generated/prisma/client";
import type { JobRef } from "@/modules/feed/jobs/applying";
import { jobSubjectId, parseJobSubject } from "../job-subject";

/** Runs closer together than this read as one sitting of work. */
const WORK_GAP_MS = 20 * 60 * 1000;

export type ThreadRunRow = Pick<
  PilotRunModel,
  | "id"
  | "taskType"
  | "subjectType"
  | "subjectId"
  | "title"
  | "summary"
  | "outcome"
  | "startedAt"
  | "finishedAt"
  | "payload"
>;

/** A job the page touched; `appliedAt` stays server-side, to tell which run applied. */
export interface ThreadJob {
  job: PilotThreadJob;
  appliedAt: Date | null;
}

/** Keyed by job subject id. */
export type ThreadJobs = Map<string, ThreadJob>;

/** Only the run the application landed in applied; an earlier skip of the same job didn't. */
function appliedDuring(run: ThreadRunRow, found: ThreadJob | undefined): boolean {
  const appliedAt = found?.appliedAt;
  if (run.taskType !== "job.apply" || found?.job.status !== "applied" || !appliedAt) {
    return false;
  }
  const finishedAt = run.finishedAt ?? appliedAt;
  return appliedAt >= run.startedAt && appliedAt <= finishedAt;
}

/** Answered questions' job subjects by question id, so an answer's run links to its job. */
export type QuestionJobs = ReadonlyMap<string, string>;

/** A job a search run created, for counting what each run found. */
export interface DiscoveredJob {
  feedId: string;
  createdAt: Date;
}

interface TimedRun {
  row: ThreadRunRow;
  line: PilotThreadRun;
}

// Lenient on purpose: an older payload shape just drops out of the tally.
const scorePayloadSchema = z.object({
  minScore: z.number(),
  entries: z.array(z.object({ key: z.string() })),
});

function scoredRefs(run: ThreadRunRow): { refs: JobRef[]; minScore: number } | null {
  const parsed = scorePayloadSchema.safeParse(run.payload);
  if (run.taskType !== "feed.score" || !run.subjectId || !parsed.success) {
    return null;
  }
  const feedId = run.subjectId;
  const refs = parsed.data.entries.map((entry) => ({ feedId, key: entry.key }));
  return { refs, minScore: parsed.data.minScore };
}

/** The job a run worked: its own subject, or for an answer's run, the question's. */
function runJobSubject(run: ThreadRunRow, questionJobs: QuestionJobs): string | null {
  if (run.subjectType === "job") {
    return run.subjectId;
  }
  if (run.taskType === "question.answered") {
    return questionJobs.get(run.subjectId) ?? null;
  }
  return null;
}

const uuid = z.uuid();

/** Jobs the runs, scores and requests name; bad ids are skipped, not thrown. */
export function threadJobRefs(
  runs: ThreadRunRow[],
  questionJobs: QuestionJobs,
  requestJobs: (string | null)[],
): JobRef[] {
  const subjects = new Set<string>();
  for (const subject of [...requestJobs, ...runs.map((run) => runJobSubject(run, questionJobs))]) {
    if (subject?.includes(":")) {
      subjects.add(subject);
    }
  }
  for (const run of runs) {
    for (const ref of scoredRefs(run)?.refs ?? []) {
      subjects.add(jobSubjectId(ref));
    }
  }
  return [...subjects].map(parseJobSubject).filter((ref) => uuid.safeParse(ref.feedId).success);
}

export function toRunLine(
  run: ThreadRunRow,
  jobs: ThreadJobs,
  questionJobs: QuestionJobs,
): TimedRun {
  const jobSubject = runJobSubject(run, questionJobs);
  const found = jobSubject ? jobs.get(jobSubject) : undefined;
  return {
    row: run,
    line: {
      runId: run.id,
      taskType: run.taskType,
      title: run.title,
      summary: run.summary ?? run.title,
      outcome: run.outcome,
      subjectType: jobSubject ? "job" : run.subjectType,
      subjectId: jobSubject ?? run.subjectId,
      job: found?.job ?? null,
      applied: appliedDuring(run, found),
      finishedAt: run.finishedAt ?? run.startedAt,
    },
  };
}

function bestOf(a: PilotThreadJob | null, b: PilotThreadJob): PilotThreadJob {
  return a?.score != null && (b.score === null || a.score >= b.score) ? a : b;
}

function tallySearches(
  block: TimedRun[],
  jobs: ThreadJobs,
  discovered: DiscoveredJob[],
): PilotThreadSearchTally | null {
  const tally: PilotThreadSearchTally = {
    searches: 0,
    newJobs: 0,
    scored: 0,
    passed: 0,
    best: null,
  };
  let counted = false;
  for (const { row, line } of block) {
    if (row.taskType === "search.discover") {
      counted = true;
      tally.searches += 1;
      tally.newJobs += discovered.filter(
        (job) =>
          job.feedId === row.subjectId &&
          job.createdAt >= row.startedAt &&
          job.createdAt <= line.finishedAt,
      ).length;
    }
    const scoring = scoredRefs(row);
    if (!scoring) {
      continue;
    }
    counted = true;
    for (const ref of scoring.refs) {
      const job = jobs.get(jobSubjectId(ref))?.job;
      if (job?.score == null) {
        continue;
      }
      tally.scored += 1;
      if (job.score >= scoring.minScore) {
        tally.passed += 1;
      }
      tally.best = bestOf(tally.best, job);
    }
  }
  return counted ? tally : null;
}

export function foldWork(
  runs: TimedRun[],
  jobs: ThreadJobs,
  discovered: DiscoveredJob[],
): PilotThreadItem[] {
  const sorted = [...runs].sort(
    (a, b) => a.line.finishedAt.getTime() - b.line.finishedAt.getTime(),
  );
  const blocks: TimedRun[][] = [];
  for (const run of sorted) {
    const block = blocks.at(-1);
    const last = block?.at(-1);
    const gap = last ? run.line.finishedAt.getTime() - last.line.finishedAt.getTime() : null;
    if (block && gap !== null && gap < WORK_GAP_MS) {
      block.push(run);
    } else {
      blocks.push([run]);
    }
  }
  return blocks.map((block) => {
    const startedAt = new Date(Math.min(...block.map((run) => run.row.startedAt.getTime())));
    const endedAt = block[block.length - 1].line.finishedAt;
    return {
      type: "work",
      id: block[0].line.runId,
      at: endedAt,
      startedAt,
      endedAt,
      runs: block.map((run) => run.line),
      searchTally: tallySearches(block, jobs, discovered),
    };
  });
}
