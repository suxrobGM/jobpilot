import type { ResumeData, ResumeExperience, ResumeProject } from "@jobpilot/contracts/resume";
import type { StructureAudit, StructurePlan } from "../variants/variant.schema";
import { parseResumeDate } from "./dates";
import { combineEntries, entryExists, promoteToEntry, type Report } from "./entries";

interface StructureValidation {
  ok: boolean;
  violations: string[];
  audit: StructureAudit;
  content: ResumeData;
}

/** An entry paired with its index in the base, so a reorder can address the base's numbering. */
interface IndexedEntry {
  entry: ResumeExperience;
  index: number;
}

/**
 * Refuses a plan that guts the history. Checked after merges, so absorbing roles is never mistaken
 * for deleting them.
 */
function checkDropLimits(survivors: number, total: number, report: Report): void {
  const dropped = report.audit.dropped.length;
  if (survivors === 0) {
    report.violations.push("dropEntries: a resume must keep at least one experience entry.");
  } else if (dropped > Math.floor(total / 2)) {
    report.violations.push(
      `dropEntries: cannot drop ${dropped} of ${total} entries (at most half).`,
    );
  }
}

function orderEntries(
  survivors: IndexedEntry[],
  entryOrder: number[] | undefined,
  report: Report,
): IndexedEntry[] {
  if (!entryOrder || entryOrder.length === 0) {
    return survivors;
  }

  const surviving = survivors.map((item) => item.index);
  const requested = entryOrder.filter((index) => surviving.includes(index));
  const isPermutation =
    requested.length === surviving.length && new Set(requested).size === surviving.length;
  if (!isPermutation) {
    report.violations.push(
      `entryOrder must be a permutation of the surviving entries (${surviving.join(", ")}).`,
    );
    return survivors;
  }

  report.audit.reordered = true;
  const byIndex = new Map(survivors.map((item) => [item.index, item]));
  return requested.map((index) => byIndex.get(index)!);
}

/** Placed by start date, not appended: an entry covering a recent gap belongs near the top. */
function insertByStart(
  entries: ResumeExperience[],
  promoted: ResumeExperience,
): ResumeExperience[] {
  const startTime = (entry: ResumeExperience) => parseResumeDate(entry.start) ?? 0;
  const at = entries.findIndex((entry) => startTime(entry) < startTime(promoted));
  if (at === -1) {
    return [...entries, promoted];
  }
  return [...entries.slice(0, at), promoted, ...entries.slice(at)];
}

/** Partial orders allowed: unlisted projects keep their relative order behind the listed ones. */
function orderProjects(
  projects: ResumeProject[],
  projectOrder: number[] | undefined,
): ResumeProject[] {
  if (!projectOrder || projectOrder.length === 0) {
    return projects;
  }
  const requested = projectOrder.filter(
    (index) => Number.isInteger(index) && index >= 0 && index < projects.length,
  );
  const rest = projects.map((_, index) => index).filter((index) => !requested.includes(index));
  return [...requested, ...rest].map((index) => projects[index]);
}

/** Fixed order - merge, drop, promote, reorder - so every index refers to the base. */
export function applyStructure(base: ResumeData, input: StructurePlan): StructureValidation {
  const report: Report = {
    violations: [],
    audit: { merged: [], dropped: [], promoted: [], reordered: false, retitled: [], flags: [] },
  };

  const experience = [...(base.experience ?? [])];
  const projects = [...(base.projects ?? [])];
  const rewritten = new Map<number, ResumeExperience>();
  const removed = new Set<number>();

  for (const merge of input.mergeEntries ?? []) {
    const combined = combineEntries(experience, merge, report);
    if (!combined) {
      continue;
    }
    rewritten.set(merge.into, combined.entry);
    for (const index of combined.absorbed) {
      removed.add(index);
    }
  }

  for (const index of input.dropEntries ?? []) {
    if (!entryExists(index, experience.length, "dropEntries", report)) {
      continue;
    }
    if (rewritten.has(index)) {
      report.violations.push(`dropEntries: entry ${index} is also a merge target.`);
      continue;
    }
    removed.add(index);
    report.audit.dropped.push(experience[index].company);
  }

  const survivors = experience
    .map((entry, index) => ({ entry: rewritten.get(index) ?? entry, index }))
    .filter(({ index }) => !removed.has(index));
  checkDropLimits(survivors.length, experience.length, report);

  const promoted = input.promoteProjects
    ? promoteToEntry(input.promoteProjects, projects, report)
    : null;

  const ordered = orderEntries(survivors, input.entryOrder, report).map(({ entry }) => entry);

  return {
    ok: report.violations.length === 0,
    violations: report.violations,
    audit: report.audit,
    content: {
      ...base,
      experience: promoted ? insertByStart(ordered, promoted) : ordered,
      projects: orderProjects(projects, input.projectOrder),
    },
  };
}
