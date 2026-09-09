import type { ResumeData } from "@jobpilot/contracts/resume";
import { type Corpus, droppedTerms, extractNumbers, unverifiedTerms } from "./facts";
import { stockPhrases } from "./phrasing";

/**
 * Controlled bullet rewording. `experience[].bullets` on the base is the master set; every rewrite
 * is checked against its original so the model can rephrase a real accomplishment but never
 * fabricate, drop a fact, or pad it with stock phrasing.
 */

interface BulletRewriteInput {
  entryIndex: number;
  bullets: { original: string; tailored: string }[];
}

interface BulletRewriteAudit {
  original: string;
  tailored: string;
}

export interface EntryRewriteAudit {
  entryIndex: number;
  company: string;
  bullets: BulletRewriteAudit[];
}

interface RewriteValidation {
  ok: boolean;
  /** Hard-guard failures. Non-empty ⇒ reject the whole request. */
  violations: string[];
  /** Per-entry audit of accepted rewrites. */
  audit: EntryRewriteAudit[];
  /** entryIndex → (trimmed original → tailored), for applying in `tailorBase`. */
  map: Map<number, Map<string, string>>;
}

const BULLET_MAX_GROWTH = 1.4;

function truncate(s: string, n = 60): string {
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

function bulletProblem(original: string, tailored: string, corpus: Corpus): string | null {
  const originalNumbers = extractNumbers(original);
  const tailoredNumbers = extractNumbers(tailored);
  const added = [...tailoredNumbers].filter((n) => !originalNumbers.has(n));
  if (added.length > 0) {
    return `introduces number(s) not in the original (${added.join(", ")})`;
  }
  const dropped = [...originalNumbers].filter((n) => !tailoredNumbers.has(n));
  if (dropped.length > 0) {
    return `drops number(s) the original stated (${dropped.join(", ")})`;
  }
  const unverified = unverifiedTerms(tailored, corpus);
  if (unverified.length > 0) {
    return `names tech the resume never mentions (${unverified.join(", ")})`;
  }
  const droppedTech = droppedTerms(original, tailored);
  if (droppedTech.length > 0) {
    return `drops tech the original named (${droppedTech.join(", ")})`;
  }
  const stock = stockPhrases(tailored);
  if (stock.length > 0) {
    return `uses stock phrasing (${stock.join(", ")})`;
  }
  if (tailored.length > original.length * BULLET_MAX_GROWTH) {
    return `grows from ${original.length} to ${tailored.length} characters; a reword may not add clauses`;
  }
  return null;
}

/**
 * Hard guards, any failure rejecting the whole request: the original must be a real bullet of an
 * existing entry, rewritten once, and the tailored text must pass `bulletProblem`.
 */
export function validateRewrites(
  base: ResumeData,
  rewrites: BulletRewriteInput[],
  corpus: Corpus,
): RewriteValidation {
  const violations: string[] = [];
  const audit: EntryRewriteAudit[] = [];
  const map = new Map<number, Map<string, string>>();
  const experience = base.experience ?? [];

  for (const { entryIndex, bullets } of rewrites) {
    const entry = experience[entryIndex];
    if (!entry) {
      violations.push(`Experience entry ${entryIndex} does not exist.`);
      continue;
    }

    const { company } = entry;
    const masterSet = new Set((entry.bullets ?? []).map((b) => b.trim()));
    const entryMap = new Map<string, string>();

    for (const pair of bullets) {
      const original = pair.original.trim();
      const tailored = pair.tailored.trim();

      if (!tailored) {
        violations.push(`${company}: empty tailored bullet for "${truncate(original)}".`);
      } else if (!masterSet.has(original)) {
        violations.push(
          `${company}: original bullet not found in the base resume: "${truncate(original)}".`,
        );
      } else if (entryMap.has(original)) {
        violations.push(`${company}: bullet rewritten more than once: "${truncate(original)}".`);
      } else {
        const problem = bulletProblem(original, tailored, corpus);
        if (problem) {
          violations.push(`${company}: reworded bullet ${problem}: "${truncate(tailored)}".`);
        } else {
          entryMap.set(original, tailored);
        }
      }
    }

    if (entryMap.size > 0) {
      map.set(entryIndex, entryMap);
      audit.push({
        entryIndex,
        company,
        bullets: [...entryMap].map(([original, tailored]) => ({ original, tailored })),
      });
    }
  }

  return { ok: violations.length === 0, violations, audit, map };
}
