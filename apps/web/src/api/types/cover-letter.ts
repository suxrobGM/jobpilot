import type { Data } from "@jobpilot/api-client";
import type { api } from "@/api/client";

/** A cover-letter list row, inferred from `GET /api/cover-letters`. */
export type CoverLetterListItem = Data<(typeof api)["cover-letters"]["get"]>["items"][number];
