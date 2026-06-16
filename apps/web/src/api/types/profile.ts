import type { Data } from "@jobpilot/api-client";
import type { api } from "@/api/eden";

/** The active profile aggregate, inferred from `GET /api/profile`. */
export type ProfileResponse = Data<typeof api.profile.get>;
export type ProfileDto = NonNullable<ProfileResponse["profile"]>;
export type AutoApplySettingsDto = NonNullable<ProfileResponse["autoApply"]>;
export type ReferenceDto = ProfileDto["references"][number];
