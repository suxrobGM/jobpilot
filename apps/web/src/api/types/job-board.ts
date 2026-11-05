import type { Data } from "@jobpilot/api-client";
import type { api } from "@/api/client";

export type JobBoardDto = Data<(typeof api)["job-boards"]["get"]>[number];
