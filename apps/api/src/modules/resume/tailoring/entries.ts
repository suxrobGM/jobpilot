// Merge and promote: the two plan steps that synthesize an experience entry. Every refusal reason
// lands in `report.violations`, so one response lists them all.
import type { ResumeExperience, ResumeProject } from "@jobpilot/contracts/resume";
import type { StructureAudit, StructurePlan } from "../variants/variant.schema";
import { dateSpan, parseResumeDate } from "./dates";

/** The employer a promoted entry gets when the model names none. */
const DEFAULT_UMBRELLA_COMPANY = "Independent Software Development";

/** Neutral employer names a merged or promoted entry may use when no single company applies. */
export const UMBRELLA_COMPANY_NAMES: readonly string[] = [
  "Independent / Contract",
  "Freelance",
  "Self-employed",
  DEFAULT_UMBRELLA_COMPANY,
];

type MergeEntry = NonNullable<StructurePlan["mergeEntries"]>[number];
type PromoteProjects = NonNullable<StructurePlan["promoteProjects"]>;

export interface Report {
  violations: string[];
  audit: StructureAudit;
}

export function entryExists(index: number, count: number, label: string, report: Report): boolean {
  if (Number.isInteger(index) && index >= 0 && index < count) {
    return true;
  }
  report.violations.push(`${label}: experience entry ${index} does not exist.`);
  return false;
}

/** A shared word means the new title plausibly describes the same role. */
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

/** Null when the merge is refused. */
export function combineEntries(
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
  const span = dateSpan(group);
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

/** Null when the promotion is refused. */
export function promoteToEntry(
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
  const span = dateSpan(chosen)!;
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
