import type { UpworkClient, UpworkQualityResult } from "@jobpilot/contracts/upwork";

/**
 * Heuristic Upwork client/job quality score - deterministic, no LLM (mirrors
 * `scoreFit` in ./fit.ts). A `skip` verdict carries the exact `skipReason` the
 * `upwork-search` skill records on the campaign Job.
 *
 * Blend (each component 0..1, an unread signal = neutral 0.5):
 *   30% payment verified
 *   20% client hire count
 *   20% spend + reviews (proven track record)
 *   15% proposal saturation (inverse - fewer competitors is better)
 *   15% recency (fresh posts get seen)
 */

// Soft floor: below this the posting is skipped even without a hard-rule hit.
const UPWORK_QUALITY_SKIP_FLOOR = 30;
const UPWORK_QUALITY_GOOD_THRESHOLD = 65;

const SATURATED_PROPOSALS = 50;

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

function saturationScore(proposals: number | null | undefined): number {
  if (proposals == null) return NEUTRAL;
  if (proposals < 5) return 1;
  if (proposals < 10) return 0.8;
  if (proposals < 15) return 0.6;
  if (proposals < 20) return 0.4;
  if (proposals < SATURATED_PROPOSALS) return 0.2;
  return 0;
}

function hireScore(hires: number | null | undefined): number {
  return tier(
    hires,
    [
      [20, 1],
      [5, 0.85],
      [1, 0.7],
    ],
    0,
  );
}

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
  if (client.clientHires != null) flags.push(`${client.clientHires} hires`);
  if (client.totalSpent != null)
    flags.push(`$${Math.round(client.totalSpent).toLocaleString()} spent`);
  if (client.reviewsCount != null) {
    const rating = client.rating != null ? ` (${client.rating.toFixed(1)}★)` : "";
    flags.push(`${client.reviewsCount} reviews${rating}`);
  }
  if (client.proposalsCount != null) flags.push(`${client.proposalsCount} proposals`);
  if (client.postedHoursAgo != null) flags.push(`Posted ${Math.round(client.postedHoursAgo)}h ago`);
  return flags;
}

export function scoreUpworkClient(client: UpworkClient): UpworkQualityResult {
  const qualityScore = Math.round(
    100 *
      (paymentScore(client.paymentVerified) * 0.3 +
        hireScore(client.clientHires) * 0.2 +
        spendReviewScore(client.totalSpent, client.reviewsCount) * 0.2 +
        saturationScore(client.proposalsCount) * 0.15 +
        recencyScore(client.postedHoursAgo) * 0.15),
  );

  const flags = buildFlags(client);

  // Hard-skip rules, in priority order.
  let skipReason: string | null = null;
  if (client.paymentVerified === false) {
    skipReason = "Unverified payment";
  } else if (client.proposalsCount != null && client.proposalsCount >= SATURATED_PROPOSALS) {
    skipReason = `Saturated - ${client.proposalsCount} proposals`;
  } else if (
    // Observed zeros only - a signal we could not read (null) stays neutral.
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
