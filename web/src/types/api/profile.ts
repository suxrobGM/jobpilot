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

  eeoGender: string | null;
  eeoRace: string | null;
  eeoEthnicity: string | null;
  eeoHispanicOrLatino: string | null;
  eeoVeteranStatus: string | null;
  eeoDisabilityStatus: string | null;

  defaultResumeId: number | null;
  updatedAt: string;
}

export interface AutopilotSettingsDto {
  id: number;
  profileId: number;
  minMatchScore: number;
  maxApplicationsPerRun: number;
  confirmMode: "batch" | "auto";
  skipCompanies: string[];
  skipTitleKeywords: string[];
  minSalary: number;
  maxSalary: number;
  salaryExpectation: string | null;
  defaultStartDate: string;
}

export interface ProfileResponse {
  profile: ProfileDto | null;
  autopilot: AutopilotSettingsDto | null;
  defaultResumeAbsolutePath: string | null;
}
