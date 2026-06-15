import type { ResumeData, ResumeSkillGroup } from "@jobpilot/contracts/resume";
import { expandSynonyms, normalizePhrase } from "@/modules/scoring/keyword-normalize";

export interface TailorOptions {
  summary?: string;
  emphasizedTech?: string[];
  jobKeywords?: string[];
  maxBulletsPerEntry?: number;
  /**
   * Validated bullet rewrites, keyed `entryIndex → (trimmed original → tailored)`.
   * Only applied to entries within `rewordTopN`. Produced by `validateRewrites`.
   */
  bulletRewrites?: Map<number, Map<string, string>>;
  /** How many of the most-recent experience entries may be reworded. Default 2. */
  rewordTopN?: number;
}

function matchesAny(text: string, terms: string[]): boolean {
  if (terms.length === 0) {
    return false;
  }

  const normedText = normalizePhrase(text);
  for (const term of terms) {
    for (const variant of expandSynonyms(term)) {
      if (variant && normedText.includes(variant)) return true;
    }
  }
  return false;
}

function bulletScore(bullet: string, keywords: string[]): number {
  if (keywords.length === 0) {
    return 0;
  }

  const normedBullet = normalizePhrase(bullet);
  let hits = 0;

  for (const kw of keywords) {
    for (const variant of expandSynonyms(kw)) {
      if (variant && normedBullet.includes(variant)) {
        hits++;
        break;
      }
    }
  }
  return hits;
}

function reorderSkillGroups(skills: ResumeSkillGroup[], emphasized: string[]): ResumeSkillGroup[] {
  if (emphasized.length === 0) {
    return skills;
  }

  const annotated = skills.map((group) => {
    const emphasis = group.items.filter((i) => matchesAny(i, emphasized));
    if (emphasis.length === 0) return { group, hasEmphasis: false };
    const rest = group.items.filter((i) => !emphasis.includes(i));
    return { group: { ...group, items: [...emphasis, ...rest] }, hasEmphasis: true };
  });

  return annotated
    .sort((a, b) => Number(b.hasEmphasis) - Number(a.hasEmphasis))
    .map((entry) => entry.group);
}

/**
 * Deterministic resume tailoring. Takes the base resume and a small set of
 * model-authored hints; returns a new ResumeData with skills reordered to
 * surface emphasized tech, bullets sorted by job-keyword overlap, and the
 * summary spliced if provided. The model never authors structured JSON —
 * just `summary` prose and a few hint arrays.
 */
export function tailorBase(base: ResumeData, opts: TailorOptions): ResumeData {
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

  const rewordTopN = Math.max(0, opts.rewordTopN ?? 2);

  const experience = (base.experience ?? []).map((entry, index) => {
    let bullets = entry.bullets ?? [];
    const entryRewrites = index < rewordTopN ? opts.bulletRewrites?.get(index) : undefined;
    if (entryRewrites) {
      // Reword from the master set before ranking; only bullets whose original
      // text matches a validated rewrite key are replaced, the rest pass through.
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
    summary: opts.summary?.trim() ? opts.summary.trim() : base.summary,
    skills,
    experience,
    projects,
  };
}
