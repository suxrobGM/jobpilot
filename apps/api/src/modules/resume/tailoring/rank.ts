import type { ResumeData, ResumeSkillGroup } from "@jobpilot/contracts/resume";
import { matchesTerm, toSearchText } from "@/modules/scoring/keyword-normalize";
import type { TailorVariantBody } from "../variants/variant.schema";

type RankOptions = Pick<
  TailorVariantBody,
  "summary" | "headline" | "emphasizedTech" | "jobKeywords" | "maxBulletsPerEntry"
>;

function matchesAny(text: string, terms: string[]): boolean {
  if (terms.length === 0) {
    return false;
  }

  const searchText = toSearchText(text);
  return terms.some((term) => matchesTerm(searchText, term));
}

function bulletScore(bullet: string, keywords: string[]): number {
  if (keywords.length === 0) {
    return 0;
  }

  const searchText = toSearchText(bullet);
  return keywords.filter((kw) => matchesTerm(searchText, kw)).length;
}

function reorderSkillGroups(skills: ResumeSkillGroup[], emphasized: string[]): ResumeSkillGroup[] {
  if (emphasized.length === 0) {
    return skills;
  }

  const annotated = skills.map((group) => {
    const emphasis = group.items.filter((i) => matchesAny(i, emphasized));
    if (emphasis.length === 0) {
      return { group, hasEmphasis: false };
    }
    const rest = group.items.filter((i) => !emphasis.includes(i));
    return { group: { ...group, items: [...emphasis, ...rest] }, hasEmphasis: true };
  });

  return annotated
    .sort((a, b) => Number(b.hasEmphasis) - Number(a.hasEmphasis))
    .map((entry) => entry.group);
}

/**
 * Surfaces emphasized tech, ranks bullets by keyword overlap, and splices in summary and headline.
 * `rewrites` is keyed `entryIndex → (trimmed original → tailored)`.
 */
export function tailorBase(
  base: ResumeData,
  opts: RankOptions,
  rewrites: Map<number, Map<string, string>> = new Map(),
): ResumeData {
  const emphasized = (opts.emphasizedTech ?? []).map((t) => t.trim()).filter(Boolean);
  const keywords = (opts.jobKeywords ?? emphasized).map((t) => t.trim()).filter(Boolean);
  const maxBullets = Math.max(1, opts.maxBulletsPerEntry ?? 6);

  const skills = reorderSkillGroups(base.skills ?? [], emphasized);

  const sortBullets = (bullets: string[]): string[] => {
    if (keywords.length === 0) {
      return bullets;
    }
    return [...bullets]
      .map((bullet, idx) => ({ bullet, idx, score: bulletScore(bullet, keywords) }))
      .sort((a, b) => b.score - a.score || a.idx - b.idx)
      .slice(0, maxBullets)
      .map((entry) => entry.bullet);
  };

  const experience = (base.experience ?? []).map((entry, index) => {
    let bullets = entry.bullets ?? [];
    const entryRewrites = rewrites.get(index);
    if (entryRewrites) {
      // Reword from the master set before ranking; unmatched bullets pass through.
      bullets = bullets.map((b) => entryRewrites.get(b.trim()) ?? b);
    }
    return { ...entry, bullets: sortBullets(bullets) };
  });

  const projects = (base.projects ?? []).map((entry) => ({
    ...entry,
    bullets: sortBullets(entry.bullets ?? []),
  }));

  return {
    ...base,
    basics: opts.headline?.trim()
      ? { ...base.basics, headline: opts.headline.trim() }
      : base.basics,
    summary: opts.summary?.trim() ? opts.summary.trim() : base.summary,
    skills,
    experience,
    projects,
  };
}
