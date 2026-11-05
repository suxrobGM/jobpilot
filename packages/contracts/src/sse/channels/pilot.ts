import type {
  PILOT_RUN_OUTCOMES,
  PilotChange,
  PilotJournalEntry,
  PilotMessage,
  PilotQuestion,
  PilotRequest,
  PilotState,
  Promotion,
  TaskType,
} from "../../pilot";
import { defineChannel } from "../channel";

export type PilotEvent =
  | { type: "journal.appended"; entry: PilotJournalEntry }
  | { type: "question.created"; question: PilotQuestion }
  | { type: "question.answered"; question: PilotQuestion }
  | { type: "state.changed"; state: PilotState }
  | { type: "promotion.created"; promotion: Promotion }
  | { type: "promotion.updated"; promotion: Promotion }
  | { type: "change.updated"; change: PilotChange }
  | { type: "message.created"; message: PilotMessage }
  | { type: "request.created"; request: PilotRequest }
  | { type: "request.updated"; request: PilotRequest }
  | { type: "run.interrupt"; runId: string }
  | { type: "run.steer"; runId: string; text: string }
  | { type: "run.started"; runId: string; taskType: TaskType }
  | { type: "run.finished"; runId: string; outcome: (typeof PILOT_RUN_OUTCOMES)[number] };

/** Parameter-free path: the server resolves the user from the session. */
export const pilotChannel = defineChannel<PilotEvent, void, { userId: string }>({
  name: "pilot",
  path: () => "/api/pilot/events",
  topic: ({ userId }) => String(userId),
});
