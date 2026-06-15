import type { Data } from "@jobpilot/api-client";
import type { api } from "@/api/eden";

/** A saved job board, inferred from `GET /api/job-boards`. */
export type JobBoardDto = Data<(typeof api)["job-boards"]["get"]>[number];
