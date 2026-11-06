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

const NEEDS_YOU_JOBS = { view: "needsYou", page: 1, limit: MAX_PAGE_SIZE } as const;

/**
 * Everything waiting on the user: open questions, proposed changes, and jobs parked for the user
 * with no open question about them.
 */
export function useNeedsYou(): Pending[] {
  const { questions } = useOpenQuestions();
  const proposals = useQuery(pilotQueries.changes("proposed")).data ?? [];
  const parked = useQuery(pipelineQueries.jobs(NEEDS_YOU_JOBS)).data?.items ?? [];

  // A job question's subject is `<feedId>:<jobKey>`.
  const asked = new Set(
    questions.flatMap((question) => (question.subjectType === "job" ? [question.subjectId] : [])),
  );
  const jobs = parked.filter((job) => !asked.has(`${job.feedId}:${job.key}`));

  return [
    ...questions.map((question) => ({ type: "question" as const, id: question.id, question })),
    ...proposals.map((change) => ({ type: "change" as const, id: change.id, change })),
    ...jobs.map((job) => ({ type: "job" as const, id: job.id, job })),
  ];
}
