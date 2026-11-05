import type { Data } from "@jobpilot/api-client";
import type { api } from "@/api/client";

/** Carries board names, not links. */
export type JobListingSummaryDto = Data<typeof api.public.jobs.get>["items"][number];

export type JobListingDto = Data<ReturnType<typeof api.public.jobs>["get"]>;

export type AdminJobListingDto = Data<(typeof api.admin)["job-listings"]["get"]>["items"][number];
