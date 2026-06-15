/**
 * Shared keyword-normalization primitives for the tech-stack matching paths
 * (`scoring/fit.ts` and `resume/tailor.ts`). NOT for title/company duplicate
 * detection — that lives in `scoring/applied-duplicates.ts` and strips
 * seniority/company suffixes for Jaro-Winkler comparison.
 */

const SYNONYMS: Record<string, string[]> = {
  js: ["javascript"],
  ts: ["typescript"],
  nextjs: ["next.js", "next"],
  nodejs: ["node", "node.js"],
  postgres: ["postgresql"],
  k8s: ["kubernetes"],
  dotnet: [".net", "aspnet"],
  golang: ["go"],
};

/** Lowercase + strip all non-alphanumerics (no spaces). Use for tight equality
 *  comparison of single tech tokens — e.g. "Next.js" → "nextjs". */
export function normalizeKeyword(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

/** Lowercase + collapse non-alphanumerics to single spaces. Use as the haystack
 *  for substring search inside bullet/sentence text — preserves word boundaries
 *  so "React.js applications" → "react js applications" matches a "react js"
 *  variant without collapsing into a single run. */
export function normalizePhrase(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const expandCache = new Map<string, string[]>();

/** Every recognised spelling of a term, returned in both compact and spaced
 *  forms so callers can substring-search either flavour. Returns deduped
 *  non-empty strings; idempotent for already-canonical inputs.
 *
 *  Memoized: tech terms repeat heavily inside `matchesAny` / `bulletScore`
 *  loops across many bullets and skill items per request. */
export function expandSynonyms(term: string): string[] {
  const cached = expandCache.get(term);
  if (cached) {
    return cached;
  }

  const variants = new Set<string>();
  const compact = normalizeKeyword(term);
  const spaced = normalizePhrase(term);
  if (compact) variants.add(compact);
  if (spaced) variants.add(spaced);

  for (const [canon, alts] of Object.entries(SYNONYMS)) {
    const altsCompact = alts.map(normalizeKeyword);
    if (compact === canon || altsCompact.includes(compact)) {
      variants.add(canon);
      for (const alt of alts) {
        const c = normalizeKeyword(alt);
        const s = normalizePhrase(alt);
        if (c) variants.add(c);
        if (s) variants.add(s);
      }
    }
  }

  const result = [...variants];
  expandCache.set(term, result);
  return result;
}
