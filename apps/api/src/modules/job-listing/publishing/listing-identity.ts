import { createHash } from "node:crypto";
import { slugify } from "@/common/utils";
import { normalizeCompanyName } from "@/modules/scoring/applied-duplicates";
import { normalizePhrase } from "@/modules/scoring/keyword-normalize";

const REMOTE_PATTERNS = [
  /\bremote\b/,
  /\banywhere\b/,
  /\bwork from home\b/,
  /\bwfh\b/,
  /\bdistributed\b/,
];

/** Remote-ish text collapses to "remote"; anything else keeps its city, so "NY, NY, USA" == "NY, NY". */
export function normalizeListingLocation(location: string | null | undefined): string {
  if (!location) {
    return "";
  }
  const cleaned = location.toLowerCase();
  if (REMOTE_PATTERNS.some((pattern) => pattern.test(cleaned))) {
    return "remote";
  }
  return normalizePhrase(cleaned.split(",")[0] ?? "");
}

export interface MatchKeyInput {
  title: string;
  company: string;
  location?: string | null;
}

/**
 * The match key: sha256 of the normalized posting. Location is in it because the same role opened
 * in two cities is two postings.
 */
export function matchKey(input: MatchKeyInput): string {
  const parts = [
    normalizePhrase(input.title),
    normalizeCompanyName(input.company),
    normalizeListingLocation(input.location),
  ];
  return createHash("sha256").update(parts.join("|")).digest("hex");
}

/** SEO slug. The key suffix makes it collision-free without a retry loop, and stable. */
export function listingSlug(input: MatchKeyInput, key: string = matchKey(input)): string {
  const stem = [slugify(input.title), "at", slugify(input.company)].filter(Boolean).join("-");
  return `${stem}-${key.slice(0, 6)}`;
}
