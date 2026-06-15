import type { ResumeData } from "@jobpilot/contracts/resume";
import { expandSynonyms, normalizePhrase } from "@/modules/scoring/keyword-normalize";

/**
 * Controlled bullet rewording. The base resume's `experience[].bullets` are the
 * master bullet set (source of truth). The model may submit reworded versions
 * for the most-recent roles only; this module validates each rewrite against its
 * master original so the model can rephrase/re-emphasize real accomplishments
 * but never fabricate numbers, scope, or tech.
 */

export interface BulletRewriteInput {
  entryIndex: number;
  bullets: { original: string; tailored: string }[];
}

export interface BulletRewriteAudit {
  original: string;
  tailored: string;
  /** Soft, non-blocking review notes (e.g. unverified tech terms). */
  flags: string[];
}

export interface EntryRewriteAudit {
  entryIndex: number;
  company: string;
  bullets: BulletRewriteAudit[];
}

/** Persisted shape for `ResumeVariant.rewrites` (stringified JSON). */
export interface VariantRewriteAudit {
  experience: EntryRewriteAudit[];
}

export interface RewriteValidation {
  ok: boolean;
  /** Hard-guard failures. Non-empty ⇒ reject the whole request. */
  violations: string[];
  /** Per-entry audit of accepted rewrites, including soft flags. */
  audit: EntryRewriteAudit[];
  /** entryIndex → (trimmed original → tailored), for applying in `tailorBase`. */
  map: Map<number, Map<string, string>>;
}

function truncate(s: string, n = 60): string {
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

function normNum(raw: string): string {
  return raw.toLowerCase().replace(/\s+/g, "").replace(/,/g, "").replace(/\.+$/, ""); // drop a trailing sentence period
}

/**
 * Numeric tokens in `text`, normalized. Captures magnitudes with their unit
 * suffix (`200+`, `40%`, `1.5m`) and also a bare-core form (`200`, `40`, `1.5`)
 * so that swapping a unit (`40%` → `40 percent`) is not treated as a new number,
 * while a genuinely different magnitude still is.
 */
export function extractNumbers(text: string): Set<string> {
  const out = new Set<string>();
  for (const m of text.matchAll(/\d[\d.,]*(?:%|\+)?[kmbx]?/gi)) {
    const full = normNum(m[0]);
    if (!full) {
      continue;
    }

    out.add(full);
    const core = full.replace(/[%+kmbx]+$/i, "");
    if (core) {
      out.add(core);
    }
  }
  return out;
}

/** All free-text from the resume, normalized — the haystack for drift checks. */
export function buildCorpus(base: ResumeData): string {
  const parts: string[] = [];

  if (base.summary) {
    parts.push(base.summary);
  }
  for (const e of base.experience ?? []) {
    parts.push(...(e.bullets ?? []));
  }
  for (const p of base.projects ?? []) {
    parts.push(...(p.bullets ?? []));
    parts.push(...(p.keywords ?? []));
    if (p.description) {
      parts.push(p.description);
    }
  }
  for (const g of base.skills ?? []) {
    parts.push(...(g.items ?? []));
  }
  return normalizePhrase(parts.join(" "));
}

/** A token that looks like a technology/proper noun rather than ordinary prose. */
function isTechLike(token: string): boolean {
  if (/\d/.test(token) && /[a-z]/i.test(token)) return true; // s3, ec2, oauth2
  if (/[a-z][A-Z]/.test(token)) return true; // GraphQL, PostgreSQL, TypeScript
  if (/^[A-Z]{2,6}$/.test(token)) return true; // AWS, GCP, SQL, REST, HIPAA
  if (/[.+#]/.test(token) && /[a-z]/i.test(token)) return true; // .NET, Node.js, C++, C#
  return false;
}

/**
 * Best-effort drift detection: tech-like tokens in `tailored` that are absent
 * from the master `original` AND from the resume `corpus`. These are flagged for
 * review, not rejected — single-capitalized names (e.g. "Kubernetes") can slip
 * past; the hard guarantee against fabrication is the numbers guard.
 */
export function driftFlags(tailored: string, original: string, corpus: string): string[] {
  const flags: string[] = [];
  const origNorm = normalizePhrase(original);
  const seen = new Set<string>();

  for (const rawToken of tailored.split(/[\s,;:()/]+/)) {
    const token = rawToken.replace(/^[^A-Za-z0-9.+#]+|[^A-Za-z0-9.+#]+$/g, "");
    if (!token || !isTechLike(token)) continue;

    const key = token.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    const variants = expandSynonyms(token);
    if (variants.some((v) => v && origNorm.includes(v))) continue; // already in the source bullet
    if (variants.some((v) => v && corpus.includes(v))) continue; // attested elsewhere in the resume
    flags.push(`unverified term: ${token}`);
  }
  return flags;
}

/**
 * Validate model-authored bullet rewrites against the base resume. Hard guards
 * (any failure rejects the whole request): the original must match a real bullet
 * of an in-window entry, with no duplicates, and the tailored text may not
 * introduce a number absent from its original. Drift is recorded as soft flags.
 */
export function validateRewrites(
  base: ResumeData,
  rewrites: BulletRewriteInput[],
  rewordTopN: number,
): RewriteValidation {
  const violations: string[] = [];
  const audit: EntryRewriteAudit[] = [];
  const map = new Map<number, Map<string, string>>();
  const experience = base.experience ?? [];
  const corpus = buildCorpus(base);

  for (const rw of rewrites) {
    const { entryIndex } = rw;

    if (entryIndex < 0 || entryIndex >= experience.length) {
      violations.push(`Experience entry ${entryIndex} does not exist.`);
      continue;
    }
    if (entryIndex >= rewordTopN) {
      violations.push(
        `Experience entry ${entryIndex} is outside the rewordable window (top ${rewordTopN} most-recent roles).`,
      );
      continue;
    }

    const entry = experience[entryIndex];
    const company = entry.company;
    const masterSet = new Set((entry.bullets ?? []).map((b) => b.trim()));
    const usedOriginals = new Set<string>();
    const entryMap = new Map<string, string>();
    const entryAudit: BulletRewriteAudit[] = [];

    for (const pair of rw.bullets) {
      const original = pair.original.trim();
      const tailored = pair.tailored.trim();

      if (!tailored) {
        violations.push(`${company}: empty tailored bullet for "${truncate(original)}".`);
        continue;
      }
      if (!masterSet.has(original)) {
        violations.push(
          `${company}: original bullet not found in the base resume: "${truncate(original)}".`,
        );
        continue;
      }
      if (usedOriginals.has(original)) {
        violations.push(`${company}: bullet rewritten more than once: "${truncate(original)}".`);
        continue;
      }
      usedOriginals.add(original);

      const originalNumbers = extractNumbers(original);
      const newNumbers = [...extractNumbers(tailored)].filter((n) => !originalNumbers.has(n));

      if (newNumbers.length > 0) {
        violations.push(
          `${company}: reworded bullet introduces number(s) not in the original (${newNumbers.join(", ")}): "${truncate(tailored)}".`,
        );
        continue;
      }

      entryMap.set(original, tailored);
      entryAudit.push({ original, tailored, flags: driftFlags(tailored, original, corpus) });
    }

    if (entryMap.size > 0) {
      map.set(entryIndex, entryMap);
      audit.push({ entryIndex, company, bullets: entryAudit });
    }
  }

  return { ok: violations.length === 0, violations, audit, map };
}
