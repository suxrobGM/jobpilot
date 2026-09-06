// Detects work-authorization restrictions a posting states; infers nothing from silence.
// Deterministic on purpose: a model misses the one bar sentence on the eightieth JD.
// US-market English only by design; other markets need their own pattern set, not more phrases here.

/**
 * Which bar the posting states. Only `sponsorship` depends on the candidate - a stated citizenship
 * or clearance requirement rules out anyone who lacks it, so the skip reason must say which it is.
 */
export const ELIGIBILITY_RESTRICTION_KINDS = ["sponsorship", "citizenship", "clearance"] as const;
type EligibilityRestrictionKind = (typeof ELIGIBILITY_RESTRICTION_KINDS)[number];

export interface EligibilityRestriction {
  kind: EligibilityRestrictionKind;
  /** The posting's own words, for the skip reason. Never paraphrased. */
  evidence: string;
}

/**
 * Phrases that state a bar. Ordered longest-intent first for better evidence, and sponsorship
 * before the rest so a posting saying both is reported as the sponsorship problem it is.
 */
const RESTRICTION_PATTERNS: { kind: EligibilityRestrictionKind; pattern: RegExp }[] = [
  // Negation near "sponsor…"/"visa…". The bounded gap absorbs hedging ("is not able to provide")
  // without reaching across a paragraph to an unrelated "not".
  {
    kind: "sponsorship",
    pattern:
      /\b(?:not|unable|cannot|can(?:'|’)t|won(?:'|’)t)\b[^.!?]{0,45}?\b(?:sponsor\w*|visa\w*)\b/i,
  },
  { kind: "sponsorship", pattern: /\bno\s+(?:visa\s+)?sponsorship\b/i },
  { kind: "sponsorship", pattern: /\bsponsorship\s+is\s+not\s+(?:available|offered|provided)\b/i },
  {
    kind: "sponsorship",
    pattern: /\bwithout\s+(?:the\s+)?need\s+for\s+(?:current\s+or\s+future\s+)?sponsorship\b/i,
  },
  { kind: "sponsorship", pattern: /\bwithout\s+(?:company\s+|employer\s+)?sponsorship\b/i },
  {
    kind: "sponsorship",
    pattern:
      /\b(?:must|required to)\s+be\s+(?:legally\s+)?authorized\s+to\s+work\b[^.!?]{0,80}\bwithout\b/i,
  },
  {
    kind: "sponsorship",
    pattern:
      /\bnot\s+(?:able|willing)\s+to\s+(?:transfer|sponsor)\b[^.!?]{0,40}\b(?:visa|h-?1b)\b/i,
  },
  {
    kind: "sponsorship",
    pattern: /\bcannot\s+(?:accept|consider)\b[^.!?]{0,40}\b(?:ead|opt|cpt|h-?1b|f-?1)\b/i,
  },
  {
    kind: "sponsorship",
    pattern: /\bno\s+(?:c2c|corp\s+to\s+corp|third[- ]party)\b[^.!?]{0,30}\bsponsor/i,
  },
  { kind: "citizenship", pattern: /\bus\s+citizens?(?:hip)?\s+(?:only|required)\b/i },
  { kind: "citizenship", pattern: /\b(?:must\s+be\s+a\s+)?(?:us|u\.s\.)\s+citizen\b/i },
  { kind: "clearance", pattern: /\bactive\s+(?:security\s+)?clearance\s+(?:is\s+)?required\b/i },
];

/** Sentence-ish window around a match, trimmed for use as quoted evidence in a skip reason. */
function evidenceAround(text: string, match: RegExpMatchArray): string {
  const index = match.index ?? 0;
  const start = text.lastIndexOf(".", index) + 1;
  const rawEnd = text.indexOf(".", index + match[0].length);
  const end = rawEnd === -1 ? text.length : rawEnd + 1;
  const sentence = text.slice(start, end).replace(/\s+/g, " ").trim();
  return sentence.length > 240 ? `${sentence.slice(0, 237)}…` : sentence;
}

/**
 * Every bar the posting states, at most one per kind, in pattern order. Empty when it states none:
 * silence is not a restriction, and guessing would drop jobs the candidate could actually get.
 */
export function detectEligibilityRestrictions(
  ...parts: (string | undefined)[]
): EligibilityRestriction[] {
  const text = parts.filter(Boolean).join(". ");
  if (!text.trim()) {
    return [];
  }

  const found = new Map<EligibilityRestrictionKind, EligibilityRestriction>();
  for (const { kind, pattern } of RESTRICTION_PATTERNS) {
    if (found.has(kind)) {
      continue;
    }
    const match = text.match(pattern);
    if (match) {
      found.set(kind, { kind, evidence: evidenceAround(text, match) });
    }
  }
  return [...found.values()];
}
