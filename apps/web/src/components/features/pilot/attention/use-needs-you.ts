"use client";

import { MAX_PAGE_SIZE } from "@jobpilot/contracts/pagination";
import type { PilotChange, PilotQuestion } from "@jobpilot/contracts/pilot";
import { useQuery } from "@tanstack/react-query";
import { pilotQueries, pipelineQueries } from "@/api/queries";
import type { PipelineJobDto } from "@/api/types";
import { useOpenQuestions } from "./use-open-questions";

export type Pending =
  | { type: "question"; id: string; question: PilotQuestion }
  | { type: "change"; id: string; change: PilotChange }
  | { type: "job"; id: string; job: PipelineJobDto };

interface JobRef {
  feedId: string;
  key: string;
}

const NEEDS_YOU_JOBS = { view: "needsYou", page: 1, limit: MAX_PAGE_SIZE } as const;

/** Parked jobs with no open question about them; the question already asks the user. */
function useUnasked<T extends JobRef>(jobs: T[]): { questions: PilotQuestion[]; jobs: T[] } {
  const { questions } = useOpenQuestions();
  // A job question's subject is `<feedId>:<jobKey>`.
  const asked = new Set(
    questions.flatMap((question) => (question.subjectType === "job" ? [question.subjectId] : [])),
  );
  return { questions, jobs: jobs.filter((job) => !asked.has(`${job.feedId}:${job.key}`)) };
}

/** Everything waiting on the user: open questions, proposed changes, and unasked parked jobs. */
export function useNeedsYou(): Pending[] {
  const proposals = useQuery(pilotQueries.changes("proposed")).data ?? [];
  const parked = useQuery(pipelineQueries.jobs(NEEDS_YOU_JOBS)).data?.items ?? [];
  const { questions, jobs } = useUnasked(parked);

  return [
    ...questions.map((question) => ({ type: "question" as const, id: question.id, question })),
    ...proposals.map((change) => ({ type: "change" as const, id: change.id, change })),
    ...jobs.map((job) => ({ type: "job" as const, id: job.id, job })),
  ];
}

/** Notices plus `useNeedsYou`'s items, from job refs instead of full rows: the badge and queue total. */
export function useNeedsYouCount(): number {
  const notices = useQuery(pilotQueries.notices()).data ?? [];
  const proposals = useQuery(pilotQueries.changes("proposed")).data ?? [];
  const parked = useQuery(pipelineQueries.needsYou()).data ?? [];
  const { questions, jobs } = useUnasked(parked);
  return notices.length + questions.length + proposals.length + jobs.length;
}

interface ParkedJob {
  job: PipelineJobDto | null;
  isPending: boolean;
}

/** One parked job by id; null once it stops waiting (applied, dismissed) or never was. */
export function useParkedJob(jobId: string): ParkedJob {
  const parked = useQuery(pipelineQueries.jobs(NEEDS_YOU_JOBS));
  const job = parked.data?.items.find((item) => item.id === jobId) ?? null;
  return { job, isPending: parked.isPending };
}
