/**
 * Keyword normalization for skill matching (`scoring/fit.ts`, `resume/tailor.ts`); duplicate
 * detection lives in `scoring/applied-duplicates.ts` instead. Match with `toSearchText` +
 * `matchesTerm` (keeps `+`/`#` so "c++"/"c#"/"c" stay distinct, and tests whole tokens);
 * `normalizePhrase` feeds the persisted dedupe keys in `job-listing/dedupe.ts`, so its output
 * must never change.
 */

import { SYNONYM_GROUPS } from "./synonyms.data";

/** Lowercase + strip everything but alphanumerics, `+` and `#` (no spaces). Use for tight
 *  equality comparison of single skill tokens - e.g. "Next.js" → "nextjs", "C#" → "c#". */
export function normalizeKeyword(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9+#]+/g, "");
}

/** Lowercase + collapse to single spaces, keeping `+` and `#`. The skill-matching haystack and
 *  needle: word boundaries survive, and "C++ / C#" stays two distinct tokens. */
export function normalizeMatchPhrase(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9+#]+/g, " ")
    .trim();
}

/** Lowercase + collapse non-alphanumerics to single spaces. Output is baked into persisted
 *  dedupe hashes (`job-listing/dedupe.ts`); use `normalizeMatchPhrase` for matching instead. */
export function normalizePhrase(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Compact form of any group member → every normalized spelling in that group. */
const groupVariantsByCompactForm = new Map<string, string[]>();

for (const group of SYNONYM_GROUPS) {
  const variants = [
    ...new Set(group.flatMap((entry) => [normalizeKeyword(entry), normalizeMatchPhrase(entry)])),
  ].filter(Boolean);
  for (const entry of group) {
    groupVariantsByCompactForm.set(normalizeKeyword(entry), variants);
  }
}

const expandCache = new Map<string, string[]>();

/** Every recognised spelling of a term, in compact and spaced forms, deduped and non-empty.
 *  Memoized: skill terms repeat heavily across bullet/skill loops per request. */
export function expandSynonyms(term: string): string[] {
  const cached = expandCache.get(term);
  if (cached) {
    return cached;
  }

  const compact = normalizeKeyword(term);
  const spaced = normalizeMatchPhrase(term);
  const variants = new Set<string>(groupVariantsByCompactForm.get(compact));
  if (compact) {
    variants.add(compact);
  }
  if (spaced) {
    variants.add(spaced);
  }

  const result = [...variants];
  expandCache.set(term, result);
  return result;
}

/** Normalized text padded so `hasWholeToken` can test word boundaries. Build it once per text. */
export function toSearchText(text: string): string {
  return ` ${normalizeMatchPhrase(text)} `;
}

/** Whole-token containment in a `toSearchText` result, so "go" does not hit "good". */
export function hasWholeToken(searchText: string, token: string): boolean {
  return token.length > 0 && searchText.includes(` ${token} `);
}

/** True when any recognised spelling of `term` sits in the text as a whole token. */
export function matchesTerm(searchText: string, term: string): boolean {
  return expandSynonyms(term).some((variant) => hasWholeToken(searchText, variant));
}
