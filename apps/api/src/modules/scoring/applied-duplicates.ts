/**
 * Applied-job duplicate matching: normalized title + employer over a Jaro-Winkler similarity.
 * Separate from its sibling `fit.ts` because job-fit scoring needs different normalization and a
 * different metric.
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
  "company",
  "group",
  "holdings",
  "gmbh",
  "ag",
  "plc",
  "sa",
  "ab",
  "oy",
  "bv",
];

/**
 * Page text scrapes glue onto an employer name - a real row stored "AbbVieNew York Stock Exchange".
 * Stripped as a trailing string, not a token, because the glue leaves no space behind it; every
 * entry is >= 4 characters so the strip cannot eat the tail of a real name ("Pulse" loses "lse").
 */
const EXCHANGE_SUFFIXES = [
  "new york stock exchange",
  "london stock exchange",
  "toronto stock exchange",
  "tokyo stock exchange",
  "hong kong stock exchange",
  "nasdaq",
  "nyse",
  "euronext",
  "hkex",
];

const EXCHANGE_SUFFIX_PATTERN = new RegExp(`(?:${EXCHANGE_SUFFIXES.join("|")})$`);

/** Below this the remainder is no longer a name, so the suffix was the whole value - leave it. */
const MIN_EMPLOYER_STEM = 3;

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function normalizeJobTitle(title: string): string {
  const tokens = tokenize(title).filter((t) => !SENIORITY_TOKENS.has(t));
  return tokens.join(" ");
}

export function normalizeCompanyName(company: string): string {
  const tokens = tokenize(company).filter((t) => !COMPANY_SUFFIXES.includes(t));
  const joined = tokens.join(" ");
  const stripped = joined.replace(EXCHANGE_SUFFIX_PATTERN, "").trim();
  return stripped.length >= MIN_EMPLOYER_STEM ? stripped : joined;
}

export const APPLIED_DUPLICATE_THRESHOLD = 90;
export const APPLIED_DUPLICATE_WINDOW_DAYS = 30;

/**
 * Employer and title each clear their own bar before the blend is consulted. On the blend alone a
 * generic title ("Director of Engineering", worth 60 of the 100) carries weak employer similarity
 * over the line: real data scored Clarity/Cardiff 74 and Imagine Learning/Orbital Engineering 76.
 */
const APPLIED_DUPLICATE_COMPANY_THRESHOLD = 90;
const APPLIED_DUPLICATE_TITLE_THRESHOLD = 85;

function jaro(a: string, b: string): number {
  if (a === b) {
    return 1;
  }
  if (a.length === 0 || b.length === 0) {
    return 0;
  }

  const matchWindow = Math.max(0, Math.floor(Math.max(a.length, b.length) / 2) - 1);
  const aMatched = new Array<boolean>(a.length).fill(false);
  const bMatched = new Array<boolean>(b.length).fill(false);
  let matches = 0;

  for (let i = 0; i < a.length; i++) {
    const start = Math.max(0, i - matchWindow);
    const end = Math.min(b.length - 1, i + matchWindow);

    for (let j = start; j <= end; j++) {
      if (bMatched[j]) {
        continue;
      }
      if (a[i] !== b[j]) {
        continue;
      }

      aMatched[i] = true;
      bMatched[j] = true;
      matches++;
      break;
    }
  }

  if (matches === 0) {
    return 0;
  }

  let k = 0;
  let transpositions = 0;

  for (let i = 0; i < a.length; i++) {
    if (!aMatched[i]) {
      continue;
    }
    while (!bMatched[k]) {
      k++;
    }
    if (a[i] !== b[k]) {
      transpositions++;
    }
    k++;
  }
  transpositions /= 2;

  return (matches / a.length + matches / b.length + (matches - transpositions) / matches) / 3;
}

/** Jaro-Winkler, scaled 0..100. The prefix boost (up to 4 chars) is what pulls "Senior Frontend
 *  Engineer" onto "Frontend Engineer" once seniority is normalized away. */
function calculateSimilarity(a: string, b: string): number {
  if (a === b) {
    return 100;
  }

  const j = jaro(a, b);
  if (j === 0) {
    return 0;
  }

  let prefix = 0;
  const maxPrefix = Math.min(4, a.length, b.length);

  for (let i = 0; i < maxPrefix; i++) {
    if (a[i] === b[i]) {
      prefix++;
    } else {
      break;
    }
  }

  const jw = j + prefix * 0.1 * (1 - j);
  return Math.round(jw * 100);
}

export interface FuzzyMatchInput {
  title: string;
  company: string;
}

export interface FuzzyMatchCandidate {
  id: string;
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
 * The prefix arm covers a short name against its legal one - Dell against Dell Technologies, worth
 * only 74 on similarity. Whole tokens only, so Meta stays off Metabase.
 */
function isSameEmployer(a: string, b: string, similarity: number): boolean {
  if (similarity >= APPLIED_DUPLICATE_COMPANY_THRESHOLD) {
    return true;
  }
  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
  return longer.startsWith(`${shorter} `);
}

/** Best match in the candidate set. The caller owns the window and tenant scope. */
export function findFuzzyDuplicate(
  input: FuzzyMatchInput,
  candidates: ReadonlyArray<FuzzyMatchCandidate>,
  threshold: number = APPLIED_DUPLICATE_THRESHOLD,
): FuzzyMatchResult | null {
  const normTitle = normalizeJobTitle(input.title);
  const normCompany = normalizeCompanyName(input.company);

  if (!normTitle || !normCompany) {
    return null;
  }

  let best: FuzzyMatchResult | null = null;

  for (const candidate of candidates) {
    const cTitle = normalizeJobTitle(candidate.title);
    const cCompany = normalizeCompanyName(candidate.company);

    if (!cTitle || !cCompany) {
      continue;
    }

    const companyScore = calculateSimilarity(normCompany, cCompany);
    if (!isSameEmployer(normCompany, cCompany, companyScore)) {
      continue;
    }

    const titleScore = calculateSimilarity(normTitle, cTitle);
    if (titleScore < APPLIED_DUPLICATE_TITLE_THRESHOLD) {
      continue;
    }

    const score = Math.round(titleScore * 0.6 + companyScore * 0.4);
    if (score >= threshold && (!best || score > best.score)) {
      best = { candidate, score };
    }
  }

  return best;
}
