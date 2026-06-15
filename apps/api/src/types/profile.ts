import type { ResumeListItem } from "./resume";

export interface ReferenceDto {
  id: number;
  name: string;
  relationship: string | null;
  company: string | null;
  email: string | null;
  phone: string | null;
}

export interface ProfileDto {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  website: string | null;
  linkedin: string | null;
  github: string | null;

  street: string | null;
  aptUnit: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  country: string | null;

  usAuthorized: boolean;
  requiresSponsorship: boolean;
  visaStatus: string | null;
  optExtension: string | null;
  willingToRelocate: boolean;
  preferredLocations: string[];
  references: ReferenceDto[];

  eeoGender: string | null;
  eeoRace: string | null;
  eeoEthnicity: string | null;
  eeoHispanicOrLatino: string | null;
  eeoVeteranStatus: string | null;
  eeoDisabilityStatus: string | null;

  primaryResumeId: number | null;
  updatedAt: string;
}

export interface AutoApplySettingsDto {
  id: number;
  profileId: number;
  minMatchScore: number;
  maxApplicationsPerCampaign: number | null;
  defaultStartDate: string;
}

export interface ProfileResponse {
  profile: ProfileDto | null;
  autoApply: AutoApplySettingsDto | null;
  primaryResumeSourceAbsolutePath: string | null;
  resumes: ResumeListItem[];
}

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
