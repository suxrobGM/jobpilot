"use client";

import type { PilotChange, PilotQuestion, Promotion } from "@jobpilot/contracts/pilot";
import { useQuery } from "@tanstack/react-query";
import { pilotQueries } from "@/api/queries";
import { useOpenQuestions } from "./use-open-questions";

export type Pending =
  | { type: "question"; id: string; question: PilotQuestion }
  | { type: "draft"; id: string; promotion: Promotion }
  | { type: "change"; id: string; change: PilotChange };

/** Everything waiting on the user: open questions, drafts to approve, and proposed changes. */
export function useNeedsYou(): Pending[] {
  const { questions } = useOpenQuestions();
  const drafts = useQuery(pilotQueries.promotions("draft")).data?.items ?? [];
  const proposals = useQuery(pilotQueries.changes("proposed")).data ?? [];
  return [
    ...questions.map((question) => ({ type: "question" as const, id: question.id, question })),
    ...drafts.map((promotion) => ({ type: "draft" as const, id: promotion.id, promotion })),
    ...proposals.map((change) => ({ type: "change" as const, id: change.id, change })),
  ];
}
