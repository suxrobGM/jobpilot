import { type Corpus, extractNumbers, unverifiedTerms } from "./facts";
import { stockPhrases } from "./phrasing";

/** Below this many content words a summary is a stub, and rewriting it is fine. */
const SUMMARY_STUB_WORDS = 8;
const SUMMARY_MIN_RETAINED = 0.5;
const SUMMARY_MAX_GROWTH = 1.25;
const SUMMARY_MAX_SENTENCES = 3;

function countSentences(text: string): number {
  return text.split(/[.!?]+(?:\s+|$)/).filter((s) => s.trim()).length;
}

/** Lowercased words of four or more letters: the wording a light edit is expected to keep. */
function contentWords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z]+/)
      .filter((word) => word.length >= 4),
  );
}

/** Violations for a tailored summary; empty means accepted. */
export function validateSummary(baseSummary: string, summary: string, corpus: Corpus): string[] {
  const violations: string[] = [];

  const stock = stockPhrases(summary);
  if (stock.length > 0) {
    violations.push(`summary uses stock phrasing (${stock.join(", ")}); say the specific thing.`);
  }
  const sentences = countSentences(summary);
  if (sentences > SUMMARY_MAX_SENTENCES) {
    violations.push(`summary has ${sentences} sentences; keep it to ${SUMMARY_MAX_SENTENCES}.`);
  }
  const newNumbers = [...extractNumbers(summary)].filter((n) => !corpus.numbers.has(n));
  if (newNumbers.length > 0) {
    violations.push(
      `summary introduces number(s) the resume never states (${newNumbers.join(", ")}).`,
    );
  }
  const unverified = unverifiedTerms(summary, corpus);
  if (unverified.length > 0) {
    violations.push(`summary names tech the resume never mentions (${unverified.join(", ")}).`);
  }

  const baseWords = contentWords(baseSummary);
  if (baseWords.size < SUMMARY_STUB_WORDS) {
    return violations;
  }
  const tailoredWords = contentWords(summary);
  const kept = [...baseWords].filter((word) => tailoredWords.has(word)).length;
  const retained = kept / baseWords.size;
  if (retained < SUMMARY_MIN_RETAINED) {
    violations.push(
      `summary keeps ${Math.round(retained * 100)}% of the base summary's wording; edit one or two sentences instead of rewriting it.`,
    );
  }
  if (summary.length > baseSummary.length * SUMMARY_MAX_GROWTH) {
    violations.push(
      `summary is ${summary.length} characters against ${baseSummary.length} in the base; it may grow by a quarter at most.`,
    );
  }
  return violations;
}

/** Violations for a retargeted headline; empty means accepted. */
export function validateHeadline(headline: string, corpus: Corpus): string[] {
  const violations: string[] = [];
  const stock = stockPhrases(headline);
  if (stock.length > 0) {
    violations.push(`headline uses stock phrasing (${stock.join(", ")}).`);
  }
  const unverified = unverifiedTerms(headline, corpus);
  if (unverified.length > 0) {
    violations.push(`headline names tech the resume never mentions (${unverified.join(", ")}).`);
  }
  return violations;
}
