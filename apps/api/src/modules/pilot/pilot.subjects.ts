// Frozen subjectKey conventions for the future AgentKnowledge table (see
// .claude/roadmap/pilot-learning.md → "Mechanics"): `subjectKey` is `board:<domain>` |
// `ats:<domain>` | `question:<hash>`. These string forms are FROZEN - learned facts will key on
// them, so never change the shape without a migration of the knowledge store.
//
// Observation journal entries are the seed write path for those facts. They already store the
// domain in `subjectId` under `subjectType: "board"` (a bare domain, no prefix). We keep that
// stored format unchanged - zero behavioral risk to the agent skill that writes it and to any
// query filtering on `subjectType: "board"` - and expose `subjectKeyForBoardEntry` to derive the
// frozen `board:<domain>` key from such an entry at learning time. New callers that need a
// canonical key build it directly with the helpers below.

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
