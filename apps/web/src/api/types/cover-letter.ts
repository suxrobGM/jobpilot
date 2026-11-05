import type { Data } from "@jobpilot/api-client";
import type { api } from "@/api/client";

export type CoverLetterListItem = Data<(typeof api)["cover-letters"]["get"]>["items"][number];
