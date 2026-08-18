// The review gate for scanned inbox mail: what applies itself, and what owes the user a decision.
// Shared by the service and the backfill seeder so the rule cannot drift between live and replay.
import type { ApplicationStatus } from "@jobpilot/contracts/application";
import {
  CLASSIFICATION_TO_STATUS,
  type Classification,
  type ReviewStatus,
} from "@jobpilot/contracts/email";

/** Scanner confidence below this leaves the message for human review. */
export const AUTO_REJECTION_MIN_CONFIDENCE = 0.95;

/**
 * Statuses an auto-rejection may move away from. Excluding `rejected`/`withdrawn` keeps a re-scan
 * idempotent; excluding `offer` keeps a hand-set outcome outranking the scanner.
 */
export const AUTO_REJECTION_FROM_STATUSES = [
  "applied",
  "screening",
  "interviewing",
] as const satisfies readonly ApplicationStatus[];

export interface AutoRejectionInput {
  classification?: Classification;
  reviewStatus?: ReviewStatus;
  matchedAppId?: string | null;
  appliedStatus?: ApplicationStatus | null;
  confidence?: number;
}

/**
 * Whether a scan result should apply itself. Only rejections qualify - monotonic and needing no
 * reply, so queueing them just leaves the funnel stale. `interviewing`/`offer` wait for a human.
 */
export function isAutoRejection(
  input: AutoRejectionInput,
): input is AutoRejectionInput & { matchedAppId: string } {
  if (input.reviewStatus !== "auto" || !input.matchedAppId) {
    return false;
  }
  if (input.confidence !== undefined && input.confidence < AUTO_REJECTION_MIN_CONFIDENCE) {
    return false;
  }
  const classified = input.classification && CLASSIFICATION_TO_STATUS[input.classification];
  return (input.appliedStatus ?? classified) === "rejected";
}

/** Outcomes a human must confirm: both need a reply, and a wrong one is expensive to unwind. */
const HUMAN_REVIEW_STATUSES = [
  "interviewing",
  "offer",
] as const satisfies readonly ApplicationStatus[];

/** Whether a scan result belongs in the review queue rather than applying itself. */
export function needsHumanReview(input: AutoRejectionInput): boolean {
  const classified = input.classification && CLASSIFICATION_TO_STATUS[input.classification];
  const resolved = input.appliedStatus ?? classified;
  return (HUMAN_REVIEW_STATUSES as readonly (ApplicationStatus | undefined)[]).includes(resolved);
}
