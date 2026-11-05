import type { Data } from "@jobpilot/api-client";
import type { api } from "@/api/client";

export type ResearchStatusDto = Data<typeof api.pilot.research.get>;

export type SavedAnswerDto = Data<typeof api.pilot.answers.get>[number];
