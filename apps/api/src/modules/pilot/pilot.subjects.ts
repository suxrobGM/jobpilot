// Frozen subjectKey conventions for the AgentKnowledge store (see .claude/roadmap/pilot-learning.md):
// `board:<domain>` | `ats:<domain>` | `question:<hash>`. The shapes are FROZEN - learned facts key
// on them, so changing them requires migrating the knowledge store. Journal observations store bare
// domains (no prefix) in `subjectId`, hence `subjectKeyForBoardEntry` to derive the frozen key.

/** Frozen knowledge key for a job board, e.g. `board:linkedin.com`. */
export function boardSubject(domain: string): string {
  return `board:${domain}`;
}

/** Frozen knowledge key for an ATS/application system, e.g. `ats:greenhouse.io`. */
export function atsSubject(domain: string): string {
  return `ats:${domain}`;
}

/**
 * Derive the frozen `board:<domain>` key from an observation journal entry, which stores the bare
 * domain in `subjectId` under `subjectType: "board"`. Returns null for any other entry shape.
 */
export function subjectKeyForBoardEntry(entry: {
  subjectType: string | null;
  subjectId: string | null;
}): string | null {
  if (entry.subjectType !== "board" || !entry.subjectId) return null;
  return boardSubject(entry.subjectId);
}
