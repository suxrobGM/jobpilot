import type { Data } from "@jobpilot/api-client";
import type { api } from "@/api/eden";

/** A resume list row, inferred from `GET /api/resumes`. */
export type ResumeListItem = Data<typeof api.resumes.get>[number];

/** A single resume, from `GET /api/resumes/:id`. */
export type ResumeDto = Data<ReturnType<typeof api.resumes>["get"]>;

/** A tailored-variant list row, from `GET /api/resumes/:id/variants`. */
export type ResumeVariantListItem = Data<ReturnType<typeof api.resumes>["variants"]["get"]>[number];

/** A single tailored variant, from `GET /api/resumes/variants/:id`. */
export type ResumeVariantDto = Data<ReturnType<(typeof api.resumes)["variants"]>["get"]>;

/** Per-bullet rewrite audit carried on a variant. */
export type VariantRewriteAudit = NonNullable<ResumeVariantDto["rewrites"]>;
export type EntryRewriteAudit = VariantRewriteAudit["experience"][number];
export type BulletRewriteAudit = EntryRewriteAudit["bullets"][number];
