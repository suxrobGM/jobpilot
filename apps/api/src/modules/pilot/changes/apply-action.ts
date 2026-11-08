import type { PilotChangeAction } from "@jobpilot/contracts/pilot";
import type { ActionContext } from "./action-context";
import { restoreJobs, skipJobs } from "./job-actions";
import {
  createSearch,
  deleteSearch,
  pauseSearch,
  resumeSearch,
  updateSearch,
} from "./search-actions";
import { deleteAnswer, setAnswer, setRules } from "./settings-actions";

/** Applies one action and returns the action that reverses it. */
function applyAction(ctx: ActionContext, action: PilotChangeAction): Promise<PilotChangeAction> {
  switch (action.type) {
    case "rules.set":
      return setRules(ctx, action);
    case "search.create":
      return createSearch(ctx, action);
    case "search.update":
      return updateSearch(ctx, action);
    case "search.pause":
      return pauseSearch(ctx, action);
    case "search.resume":
      return resumeSearch(ctx, action);
    case "search.delete":
      return deleteSearch(ctx, action);
    case "answer.set":
      return setAnswer(ctx, action);
    case "answer.delete":
      return deleteAnswer(ctx, action);
    case "jobs.skip":
      return skipJobs(ctx, action);
    case "jobs.restore":
      return restoreJobs(ctx, action);
  }
}

/** Every action applied in order; the returned inverses run in reverse to undo them. */
export async function applyActions(
  ctx: ActionContext,
  actions: PilotChangeAction[],
): Promise<PilotChangeAction[]> {
  const inverses: PilotChangeAction[] = [];
  for (const action of actions) {
    inverses.push(await applyAction(ctx, action));
  }
  return inverses.reverse();
}
