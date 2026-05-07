/**
 * Job-application duplicate matching.
 *
 * Pattern lifted from job-ops applied-duplicate-matching.ts: normalize the
 * title and employer, run a Jaro-Winkler similarity, treat scores >= 90 as
 * duplicates within a 30-day rolling window.
 */

const SENIORITY_TOKENS = new Set([
  "junior",
  "jr",
  "mid",
  "senior",
  "sr",
  "staff",
  "principal",
  "lead",
  "head",
  "director",
  "vp",
  "vice",
  "president",
  "chief",
  "ii",
  "iii",
  "iv",
  "associate",
]);

const COMPANY_SUFFIXES = [
  "inc",
  "incorporated",
  "ltd",
  "limited",
  "llc",
  "co",
  "corp",
  "corporation",
  "gmbh",
  "ag",
  "plc",
  "sa",
  "ab",
  "oy",
  "bv",
];

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

export function normalizeJobTitle(title: string): string {
  const tokens = tokenize(title).filter((t) => !SENIORITY_TOKENS.has(t));
  return tokens.join(" ");
}

export function normalizeCompanyName(company: string): string {
  const tokens = tokenize(company).filter((t) => !COMPANY_SUFFIXES.includes(t));
  return tokens.join(" ");
}

export const APPLIED_DUPLICATE_THRESHOLD = 90;
export const APPLIED_DUPLICATE_WINDOW_DAYS = 30;

/**
 * Jaro similarity, returning a score 0..1.
 */
function jaro(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length === 0 || b.length === 0) return 0;
  const matchWindow = Math.max(0, Math.floor(Math.max(a.length, b.length) / 2) - 1);
  const aMatched = new Array<boolean>(a.length).fill(false);
  const bMatched = new Array<boolean>(b.length).fill(false);
  let matches = 0;
  for (let i = 0; i < a.length; i++) {
    const start = Math.max(0, i - matchWindow);
    const end = Math.min(b.length - 1, i + matchWindow);
    for (let j = start; j <= end; j++) {
      if (bMatched[j]) continue;
      if (a[i] !== b[j]) continue;
      aMatched[i] = true;
      bMatched[j] = true;
      matches++;
      break;
    }
  }
  if (matches === 0) return 0;

  let k = 0;
  let transpositions = 0;
  for (let i = 0; i < a.length; i++) {
    if (!aMatched[i]) continue;
    while (!bMatched[k]) k++;
    if (a[i] !== b[k]) transpositions++;
    k++;
  }
  transpositions /= 2;

  return (
    (matches / a.length + matches / b.length + (matches - transpositions) / matches) /
    3
  );
}

/**
 * Jaro-Winkler similarity, scaled 0..100. Boosts strings sharing a common
 * prefix (up to 4 chars) — typical for job titles like "Senior Frontend Engineer"
 * matching "Frontend Engineer" once seniority is normalized away.
 */
export function calculateSimilarity(a: string, b: string): number {
  if (a === b) return 100;
  const j = jaro(a, b);
  if (j === 0) return 0;
  let prefix = 0;
  const maxPrefix = Math.min(4, a.length, b.length);
  for (let i = 0; i < maxPrefix; i++) {
    if (a[i] === b[i]) prefix++;
    else break;
  }
  const jw = j + prefix * 0.1 * (1 - j);
  return Math.round(jw * 100);
}

export interface FuzzyMatchInput {
  title: string;
  company: string;
}

export interface FuzzyMatchCandidate {
  id: number;
  url: string;
  title: string;
  company: string;
  appliedAt: Date | string;
}

export interface FuzzyMatchResult {
  candidate: FuzzyMatchCandidate;
  score: number;
}

/**
 * Pick the best fuzzy match within a candidate set using the normalized
 * title + company comparison. Caller is responsible for restricting
 * candidates to the 30-day window and tenant scope.
 */
export function findFuzzyDuplicate(
  input: FuzzyMatchInput,
  candidates: ReadonlyArray<FuzzyMatchCandidate>,
  threshold: number = APPLIED_DUPLICATE_THRESHOLD,
): FuzzyMatchResult | null {
  const normTitle = normalizeJobTitle(input.title);
  const normCompany = normalizeCompanyName(input.company);
  if (!normTitle || !normCompany) return null;

  let best: FuzzyMatchResult | null = null;
  for (const candidate of candidates) {
    const cTitle = normalizeJobTitle(candidate.title);
    const cCompany = normalizeCompanyName(candidate.company);
    if (!cTitle || !cCompany) continue;
    const titleScore = calculateSimilarity(normTitle, cTitle);
    const companyScore = calculateSimilarity(normCompany, cCompany);
    const score = Math.round(titleScore * 0.6 + companyScore * 0.4);
    if (score >= threshold && (!best || score > best.score)) {
      best = { candidate, score };
    }
  }
  return best;
}
