import { defineChannel } from "../channel";

export type PilotEvent =
  | { type: "journal.appended"; entry: unknown }
  | { type: "question.created"; question: unknown }
  | { type: "question.answered"; question: unknown }
  | { type: "state.changed"; state: unknown }
  | { type: "promotion.created"; promotion: unknown }
  | { type: "promotion.updated"; promotion: unknown };

/**
 * Profile-scoped Pilot feed (journal entries, questions, state changes).
 * Parameter-free path; the server resolves the profile from the session.
 */
export const pilotChannel = defineChannel<PilotEvent, void, { profileId: string }>({
  name: "pilot",
  path: () => "/api/pilot/events",
  topic: ({ profileId }) => String(profileId),
});
