import type { Data } from "@jobpilot/api-client";
import type { api } from "@/api/client";

export type ResumeDto = Data<ReturnType<typeof api.resumes>["get"]>;

export type ResumeVariantListItem = Data<ReturnType<typeof api.resumes>["variants"]["get"]>[number];

export type ResumeVariantDto = Data<ReturnType<(typeof api.resumes)["variants"]>["get"]>;
