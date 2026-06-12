import type { ProposalsBucket, UpworkClient, UpworkQualityResult } from "@/api/contracts/upwork";

/**
 * Heuristic Upwork client/job quality score. Server-side, deterministic, no LLM
 * (mirrors `scoreFit` in ./fit.ts). The `upwork-search` skill calls this to
 * smart-filter postings before recommending them: a `skip` verdict carries the
 * exact `skipReason` to record on the campaign Job.
 *
 * Every signal is nullable — a partially-readable card degrades toward a
 * neutral 0.5 rather than failing.
 *
 * Quality blend (each component 0..1, null = neutral 0.5):
 *   30% payment verified
 *   20% client hire rate
 *   20% spend + reviews (proven track record)
 *   15% proposal saturation (inverse — fewer competitors is better)
 *   15% recency (fresh posts get seen)
 */

// Soft floor: below this the posting is skipped even without a hard-rule hit.
export const UPWORK_QUALITY_SKIP_FLOOR = 30;
export const UPWORK_QUALITY_GOOD_THRESHOLD = 65;

// Hard-rule tuning.
const LOW_HIRE_RATE_PCT = 10;
const MIN_REVIEWS_FOR_HIRE_RATE = 3;

const NEUTRAL = 0.5;

function paymentScore(verified: boolean | null | undefined): number {
  if (verified === true) return 1;
  if (verified === false) return 0;
  return NEUTRAL;
}

/** First step whose threshold the value meets (descending); null → neutral, none met → `floor`. */
function tier(
  value: number | null | undefined,
  steps: ReadonlyArray<readonly [threshold: number, score: number]>,
  floor: number,
): number {
  if (value == null) return NEUTRAL;
  return steps.find(([threshold]) => value >= threshold)?.[1] ?? floor;
}

function spendReviewScore(
  spent: number | null | undefined,
  reviews: number | null | undefined,
): number {
  const spendTier = tier(
    spent,
    [
      [10_000, 1],
      [1_000, 0.8],
      [100, 0.6],
      [1, 0.4],
    ],
    0.1,
  );
  const reviewTier = tier(
    reviews,
    [
      [20, 1],
      [5, 0.8],
      [1, 0.6],
    ],
    0.2,
  );
  return (spendTier + reviewTier) / 2;
}

const SATURATION_BY_BUCKET: Record<ProposalsBucket, number> = {
  "<5": 1,
  "5-10": 0.8,
  "10-15": 0.6,
  "15-20": 0.4,
  "20-50": 0.2,
  "50+": 0,
};

function recencyScore(hoursAgo: number | null | undefined): number {
  if (hoursAgo == null) return NEUTRAL;
  if (hoursAgo <= 24) return 1;
  if (hoursAgo <= 72) return 0.8;
  if (hoursAgo <= 168) return 0.6;
  if (hoursAgo <= 336) return 0.4;
  return 0.2;
}

function buildFlags(client: UpworkClient): string[] {
  const flags: string[] = [];
  if (client.paymentVerified != null) {
    flags.push(client.paymentVerified ? "Payment verified" : "Payment unverified");
  }
  if (client.hireRate != null) flags.push(`Hire rate ${Math.round(client.hireRate)}%`);
  if (client.totalSpent != null)
    flags.push(`$${Math.round(client.totalSpent).toLocaleString()} spent`);
  if (client.reviewsCount != null) {
    const rating = client.rating != null ? ` (${client.rating.toFixed(1)}★)` : "";
    flags.push(`${client.reviewsCount} reviews${rating}`);
  }
  if (client.proposalsBucket != null) flags.push(`${client.proposalsBucket} proposals`);
  if (client.postedHoursAgo != null) flags.push(`Posted ${Math.round(client.postedHoursAgo)}h ago`);
  return flags;
}

export function scoreUpworkClient(client: UpworkClient): UpworkQualityResult {
  const qualityScore = Math.round(
    100 *
      (paymentScore(client.paymentVerified) * 0.3 +
        (client.hireRate == null ? NEUTRAL : client.hireRate / 100) * 0.2 +
        spendReviewScore(client.totalSpent, client.reviewsCount) * 0.2 +
        (client.proposalsBucket == null ? NEUTRAL : SATURATION_BY_BUCKET[client.proposalsBucket]) *
          0.15 +
        recencyScore(client.postedHoursAgo) * 0.15),
  );

  const flags = buildFlags(client);

  // Hard-skip rules, in priority order.
  let skipReason: string | null = null;
  if (client.paymentVerified === false) {
    skipReason = "Unverified payment";
  } else if (client.proposalsBucket === "50+") {
    skipReason = "Saturated — 50+ proposals";
  } else if (
    client.hireRate != null &&
    client.hireRate < LOW_HIRE_RATE_PCT &&
    (client.reviewsCount ?? 0) >= MIN_REVIEWS_FOR_HIRE_RATE
  ) {
    skipReason = `Low hire rate (${Math.round(client.hireRate)}%) — posts but rarely hires`;
  } else if (
    // Observed zeros only — a card we simply couldn't read (null) stays neutral.
    client.totalSpent === 0 &&
    client.reviewsCount === 0 &&
    client.paymentVerified !== true
  ) {
    skipReason = "Unproven & unverified client";
  } else if (qualityScore < UPWORK_QUALITY_SKIP_FLOOR) {
    skipReason = `Low client-quality score (${qualityScore})`;
  }

  const verdict = skipReason
    ? "skip"
    : qualityScore >= UPWORK_QUALITY_GOOD_THRESHOLD
      ? "good"
      : "caution";

  return { qualityScore, verdict, flags, skipReason };
}
