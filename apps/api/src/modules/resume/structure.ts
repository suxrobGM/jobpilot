// Structural rewriting: reorder, drop, merge entries, promote projects.
// Bullet ranking is `tailor.ts`, rewording is `rewrite.ts`; this moves whole sections.
//
// What keeps it honest: the model picks *which* entries combine, the server derives every date and
// whitelists employer text. No field accepts an employer or date range the base doesn't support.
import type { ResumeData, ResumeExperience, ResumeProject } from "@jobpilot/contracts/resume";
import type { z } from "zod/v4";
import { parseResumeDate, spanOf } from "./dates";
import type { resumeStructureSchema } from "./resume.schema";

/** The employer a promoted entry gets when the model names none. */
const DEFAULT_UMBRELLA_COMPANY = "Independent Software Development";

/** Neutral employer names a merged or promoted entry may use when no single company applies. */
export const UMBRELLA_COMPANY_NAMES: readonly string[] = [
  "Independent / Contract",
  "Freelance",
  "Self-employed",
  DEFAULT_UMBRELLA_COMPANY,
];

/** Derived from the request schema: the validator and the applier cannot describe different plans. */
export type StructureInput = z.infer<typeof resumeStructureSchema>;
type MergeEntry = NonNullable<StructureInput["mergeEntries"]>[number];
type PromoteProjects = NonNullable<StructureInput["promoteProjects"]>;

export interface StructureAudit {
  merged: { company: string; absorbed: string[]; start: string; end: string }[];
  dropped: string[];
  promoted: { company: string; projects: string[]; start: string; end: string }[];
  reordered: boolean;
  retitled: { company: string; from: string; to: string }[];
  /** Soft, non-blocking review notes - mirrors the bullet-rewrite flags. */
  flags: string[];
}

export interface StructureValidation {
  ok: boolean;
  violations: string[];
  audit: StructureAudit;
  content: ResumeData;
}

/** Why the plan was refused, plus the record of what it did. Threaded through every stage. */
interface Report {
  violations: string[];
  audit: StructureAudit;
}

/** An entry paired with its index in the base, so a reorder can address the base's numbering. */
interface IndexedEntry {
  entry: ResumeExperience;
  index: number;
}

/** True when the index addresses a real entry; otherwise reports it against `label`. */
function entryExists(index: number, count: number, label: string, report: Report): boolean {
  if (Number.isInteger(index) && index >= 0 && index < count) {
    return true;
  }
  report.violations.push(`${label}: experience entry ${index} does not exist.`);
  return false;
}

/** Whether a proposed title still describes the same role. Shared word ⇒ plausible, else flagged. */
function titlesOverlap(original: string, proposed: string): boolean {
  const tokens = (s: string) =>
    new Set(
      s
        .toLowerCase()
        .split(/[^a-z0-9+#.]+/)
        .filter((t) => t.length > 2),
    );
  const originalTokens = tokens(original);
  return [...tokens(proposed)].some((t) => originalTokens.has(t));
}

/** The merged entry's title, recorded in the audit and flagged when it no longer describes the role. */
function retitle(
  target: ResumeExperience,
  proposed: string | undefined,
  company: string,
  report: Report,
): string {
  if (!proposed || proposed === target.title) {
    return target.title;
  }
  report.audit.retitled.push({ company, from: target.title, to: proposed });
  if (!titlesOverlap(target.title, proposed)) {
    report.audit.flags.push(`retitled: "${target.title}" -> "${proposed}"`);
  }
  return proposed;
}

/**
 * The entry one merge produces and the indices it absorbs, or null when the merge is refused -
 * every refusal reason lands in `report.violations`.
 */
function combineEntries(
  experience: ResumeExperience[],
  merge: MergeEntry,
  report: Report,
): { entry: ResumeExperience; absorbed: number[] } | null {
  if (!entryExists(merge.into, experience.length, "mergeEntries", report)) {
    return null;
  }
  const absorbed = merge.from.filter((index) =>
    entryExists(index, experience.length, "mergeEntries", report),
  );
  if (absorbed.length !== merge.from.length) {
    return null;
  }
  if (absorbed.includes(merge.into)) {
    report.violations.push(`mergeEntries: entry ${merge.into} cannot be merged into itself.`);
    return null;
  }

  const target = experience[merge.into];
  const group = [target, ...absorbed.map((index) => experience[index])];
  const span = spanOf(group);
  if (!span) {
    report.violations.push(
      `mergeEntries: cannot merge ${target.company} - no parseable start date among the merged roles.`,
    );
    return null;
  }

  const company = merge.company ?? target.company;
  const allowed = new Set<string>([
    ...group.map((entry) => entry.company),
    ...UMBRELLA_COMPANY_NAMES,
  ]);
  if (!allowed.has(company)) {
    report.violations.push(
      `mergeEntries: "${company}" is neither one of the merged employers nor an umbrella name (${UMBRELLA_COMPANY_NAMES.join(", ")}).`,
    );
    return null;
  }

  const title = retitle(target, merge.title, company, report);
  report.audit.merged.push({
    company,
    absorbed: absorbed.map((index) => experience[index].company),
    start: span.start,
    end: span.end,
  });

  return {
    entry: {
      ...target,
      company,
      title,
      // Server-derived: the model picks which roles combine, never the resulting range.
      start: span.start,
      end: span.end,
      bullets: group.flatMap((entry) => entry.bullets ?? []),
    },
    absorbed,
  };
}

function projectToBullets(project: ResumeProject): string[] {
  // Name-prefixed so a promoted bullet still says what it belongs to; the name is the only addition.
  return (project.bullets ?? []).map((bullet) => `${project.name}: ${bullet}`);
}

/**
 * The synthesized experience entry for a set of promoted projects, or null when the plan is
 * refused - every refusal reason lands in `report.violations`.
 */
function promoteToEntry(
  promote: PromoteProjects,
  projects: ResumeProject[],
  report: Report,
): ResumeExperience | null {
  const chosen: ResumeProject[] = [];
  for (const index of promote.projects) {
    if (!Number.isInteger(index) || index < 0 || index >= projects.length) {
      report.violations.push(`promoteProjects: project ${index} does not exist.`);
      continue;
    }
    chosen.push(projects[index]);
  }
  if (chosen.length === 0) {
    return null;
  }

  const undated = chosen.filter((project) => parseResumeDate(project.start) === null);
  if (undated.length > 0) {
    // Promotion exists to occupy a stretch of timeline; without real dates there is nothing to
    // occupy it with, and inventing a range is the one thing this must not do.
    report.violations.push(
      `promoteProjects: ${undated.map((p) => p.name).join(", ")} has no start date. Add dates to the project first - a promoted entry's range is derived, never invented.`,
    );
    return null;
  }

  const company = promote.company ?? DEFAULT_UMBRELLA_COMPANY;
  if (!UMBRELLA_COMPANY_NAMES.includes(company)) {
    report.violations.push(
      `promoteProjects: "${company}" is not an umbrella name (${UMBRELLA_COMPANY_NAMES.join(", ")}). A promoted project has no employer.`,
    );
    return null;
  }

  // Non-null: every chosen project parsed a start date above.
  const span = spanOf(chosen)!;
  report.audit.promoted.push({
    company,
    projects: chosen.map((project) => project.name),
    start: span.start,
    end: span.end,
  });

  return {
    company,
    title: promote.title ?? "Independent Software Engineer",
    start: span.start,
    end: span.end,
    bullets: chosen.flatMap(projectToBullets),
  };
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

/** The requested permutation of the survivors; the list unchanged when the order is absent or invalid. */
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
  const startOf = (entry: ResumeExperience) => parseResumeDate(entry.start) ?? 0;
  const at = entries.findIndex((entry) => startOf(entry) < startOf(promoted));
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

/**
 * Validates a plan and returns the restructured content. Fixed order - merge, drop, promote,
 * reorder - so every input index refers to the base, not an intermediate state.
 */
export function applyStructure(base: ResumeData, input: StructureInput): StructureValidation {
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
