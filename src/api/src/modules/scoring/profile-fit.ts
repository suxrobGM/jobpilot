import type { ResumeData } from "@jobpilot/contracts/resume";

/** Calculates the number of years since the earliest experience date in the resume content */
export function yearsSinceEarliestExperience(content: ResumeData): number | null {
  const dates = (content.experience ?? [])
    .map((e) => e.start)
    .filter((s): s is string => typeof s === "string" && s.length > 0)
    .map((s) => new Date(s))
    .filter((d) => !Number.isNaN(d.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());

  if (dates.length === 0) {
    return null;
  }

  const yearsDiff = (Date.now() - dates[0].getTime()) / (1000 * 60 * 60 * 24 * 365.25);
  return Math.max(0, Math.round(yearsDiff));
}

/** Derives the fit inputs for a profile based on their resume content */
export function deriveProfileFitInputs(content: ResumeData): {
  techStack: string[];
  yearsExperience: number | null;
} {
  const techStack = (content.skills ?? []).flatMap((group) => group.items ?? []).filter(Boolean);
  return { techStack, yearsExperience: yearsSinceEarliestExperience(content) };
}
