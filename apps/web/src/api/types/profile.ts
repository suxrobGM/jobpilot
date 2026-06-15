import type { Data } from "@jobpilot/api-client";
import type { api } from "@/api/eden";

/** The active profile aggregate, inferred from `GET /api/profile`. */
export type ProfileResponse = Data<typeof api.profile.get>;
export type ProfileDto = NonNullable<ProfileResponse["profile"]>;
export type AutoApplySettingsDto = NonNullable<ProfileResponse["autoApply"]>;
export type ReferenceDto = ProfileDto["references"][number];

/**
 * Multi-profile management types (stale). The rail's `ProfileSwitcher` and the
 * onboarding draft-profile flow call `/api/profiles*` collection endpoints that
 * the current single-profile-per-user backend does not expose, so these cannot
 * be Eden-inferred. Kept as manual declarations until that feature is reworked
 * or removed.
 */
export interface ProfileListItemDto {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  isActive: boolean;
}

export interface CreateProfileResponse {
  id: number;
}

export interface ActiveProfileResponse {
  profileId: number | null;
}

export interface SetActiveProfileResponse {
  profileId: number;
}

export interface DeleteProfileResponse {
  deleted: number;
  activeProfileId: number;
}
