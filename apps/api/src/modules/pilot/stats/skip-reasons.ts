import {
  detectEligibilityRestrictions,
  ELIGIBILITY_RESTRICTION_KINDS,
} from "@/modules/scoring/eligibility";

/** Reuses the scoring module's eligibility kinds; a private copy would drift from its patterns. */
export const SKIP_BUCKETS = [
  ...ELIGIBILITY_RESTRICTION_KINDS,
  "alreadyApplied",
  "captcha",
  "payment",
  "belowMinScore",
  "capReached",
  "postingClosed",
  "wentStale",
  "goalsChanged",
  "unanswered",
  "other",
] as const;
export type SkipBucket = (typeof SKIP_BUCKETS)[number];

/**
 * Skips the server writes itself. Their bucket is declared here rather than guessed at by the
 * classifier below, which only ever saw agent prose: left to it, "went stale" and "goals changed"
 * both land in `other`, and an expired question reads as a closed posting.
 */
export const SERVER_SKIP_REASONS = {
  wentStale: "Posting went stale before the pilot applied.",
  goalsChanged: "Goals changed before this was applied to.",
  unanswered: "Question expired without an answer.",
} satisfies Partial<Record<SkipBucket, string>>;

const SERVER_BUCKET_BY_REASON = new Map<string, SkipBucket>(
  Object.entries(SERVER_SKIP_REASONS).map(([bucket, reason]) => [reason, bucket as SkipBucket]),
);

/** Substring tests over the phrasings `_shared/eligibility.md` tells the agent to write. */
const PROSE_BUCKETS: [needle: string, bucket: SkipBucket][] = [
  ["already applied", "alreadyApplied"],
  ["captcha", "captcha"],
  ["payment", "payment"],
  ["minimum match score", "belowMinScore"],
  ["below min", "belowMinScore"],
  ["cap reached", "capReached"],
  ["expired", "postingClosed"],
  ["no longer", "postingClosed"],
  ["closed", "postingClosed"],
];

/**
 * Buckets a free-text `skipReason`; agent-written prose means grouping the raw column in SQL yields
 * one row per wording.
 */
export function classifySkipReason(reason: string): SkipBucket {
  const server = SERVER_BUCKET_BY_REASON.get(reason);
  if (server) return server;

  const blocked = detectEligibilityRestrictions(reason)[0];
  if (blocked) return blocked.kind;

  const text = reason.toLowerCase();
  return PROSE_BUCKETS.find(([needle]) => text.includes(needle))?.[1] ?? "other";
}
