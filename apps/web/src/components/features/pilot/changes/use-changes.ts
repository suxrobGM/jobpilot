"use client";

import type { CreatePilotChangeInput } from "@jobpilot/contracts/pilot";
import { api } from "@/api/client";
import { pilotQueries, pipelineQueries } from "@/api/queries";
import { useApiMutation } from "@/api/use-api-mutation";

/** Body shape the web sends; source and propose take their defaults. */
type ChangeBody = Pick<CreatePilotChangeInput, "summary" | "actions">;

const INVALIDATE = [
  pilotQueries.state().queryKey,
  pilotQueries.changesAll,
  pilotQueries.searches().queryKey,
  pilotQueries.savedAnswers().queryKey,
  pilotQueries.threadAll,
  pipelineQueries.all,
];

/** A user edit, applied at once; Undo lives on its card in the pilot's thread. */
export function useMakeChange(onSuccess?: () => void) {
  return useApiMutation(
    (body: ChangeBody) => api.pilot.changes.post({ ...body, source: "user", propose: false }),
    {
      invalidate: INVALIDATE,
      successMessage: "Saved. You can undo it from the Pilot page.",
      onSuccess,
    },
  );
}

type Decision = "apply" | "dismiss" | "undo";

const DECISION_MESSAGES: Record<Decision, string> = {
  apply: "Applied.",
  dismiss: "Dismissed.",
  undo: "Undone.",
};

export function useDecideChange(id: string) {
  return useApiMutation(
    (decision: Decision) => {
      const change = api.pilot.changes({ id });
      if (decision === "apply") {
        return change.apply.post();
      }
      return decision === "dismiss" ? change.dismiss.post() : change.undo.post();
    },
    { invalidate: INVALIDATE, successMessage: (_data, decision) => DECISION_MESSAGES[decision] },
  );
}
