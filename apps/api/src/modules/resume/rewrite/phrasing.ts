/** Stock resume phrasing that reads as machine-written. Matched whole-word, case-insensitive. */
const STOCK_PHRASES = [
  "comfortable with",
  "comfortable moving",
  "comfortable working",
  "hands-on",
  "hands on experience",
  "enjoys",
  "passionate",
  "results-driven",
  "results driven",
  "detail-oriented",
  "self-starter",
  "fast-paced",
  "track record",
  "cutting-edge",
  "state-of-the-art",
  "leverage",
  "leveraging",
  "spearheaded",
  "seasoned",
  "stakeholders",
  "business requirements",
  "production-grade",
  "best practices",
  "cross-functional",
  "end-to-end",
  "end to end",
  "picking up",
  "quick learner",
  "eager to",
  "thrives",
  "suited to",
  "the same",
  "downstream",
].map((phrase) => ({
  phrase,
  pattern: new RegExp(`(^|[^a-z])${phrase.replace(/[-.]/g, "\\$&")}([^a-z]|$)`),
}));

/** The stock phrases `text` uses. */
export function stockPhrases(text: string): string[] {
  const lower = text.toLowerCase();
  return STOCK_PHRASES.filter(({ pattern }) => pattern.test(lower)).map(({ phrase }) => phrase);
}
