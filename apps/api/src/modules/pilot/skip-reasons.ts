/** The skip reasons the server writes itself; the agent writes its own in prose. */
export const SERVER_SKIP_REASONS = {
  wentStale: "Posting went stale before the pilot applied.",
  goalsChanged: "Goals changed before this was applied to.",
  unanswered: "Question expired without an answer.",
};
