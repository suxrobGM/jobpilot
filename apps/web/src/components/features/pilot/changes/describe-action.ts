import type { PilotChangeAction } from "@jobpilot/contracts/pilot";
import { plural } from "@/utils/format";

/** Search ids → names, so a line can say which search it touched. */
type SearchNames = ReadonlyMap<string, string>;

function searchName(names: SearchNames, id: string): string {
  return names.get(id) ?? "a search";
}

function describeRules(action: Extract<PilotChangeAction, { type: "rules.set" }>): string {
  const parts: string[] = [];
  if (action.dailyApplyCap !== undefined) {
    parts.push(`${action.dailyApplyCap} a day`);
  }
  if (action.minScore !== undefined) {
    parts.push(`score ${action.minScore}+`);
  }
  if (action.dealBreakers !== undefined) {
    parts.push(
      action.dealBreakers.length > 0
        ? `skip: ${action.dealBreakers.join(", ")}`
        : "no deal-breakers",
    );
  }
  return `Rules: ${parts.join(" · ")}`;
}

/** One plain line per action, as the change card lists them. */
export function describeAction(action: PilotChangeAction, names: SearchNames): string {
  switch (action.type) {
    case "goals.set":
      return "Goals rewritten";
    case "rules.set":
      return describeRules(action);
    case "search.create":
      return `New search: ${action.name}`;
    case "search.update":
      return `Search edited: ${action.name ?? searchName(names, action.searchId)}`;
    case "search.pause":
      return `Paused: ${searchName(names, action.searchId)}`;
    case "search.resume":
      return `Resumed: ${searchName(names, action.searchId)}`;
    case "search.delete":
      return `Deleted: ${searchName(names, action.searchId)}`;
    case "answer.set":
      return `Saved answer: ${action.key.replaceAll("_", " ")} = ${action.value}`;
    case "answer.delete":
      return `Forgot answer: ${action.key.replaceAll("_", " ")}`;
    case "jobs.skip":
      return `Skipped ${plural(action.refs.length, "job")}: ${action.reason}`;
    case "jobs.skipApproved":
      return `Skipped approved jobs: ${action.reason}`;
    case "jobs.restore":
      return `Restored ${plural(action.refs.length, "job")}`;
  }
}
