import { notFound } from "@/common/errors";
import type { Prisma } from "@/generated/prisma/client";

/** Every applicant field, as `GET /user` and `/me` return them flat beside the account. */
export const PROFILE_SELECT = {
  availability: true,
  showResume: true,
  showWebsite: true,
  showLinkedin: true,
  showGithub: true,
  firstName: true,
  lastName: true,
  contactEmail: true,
  phone: true,
  website: true,
  linkedin: true,
  github: true,
  street: true,
  aptUnit: true,
  city: true,
  state: true,
  zipCode: true,
  country: true,
  usAuthorized: true,
  requiresSponsorship: true,
  preferCapExempt: true,
  visaStatus: true,
  optExtension: true,
  willingToRelocate: true,
  preferredLocations: true,
  eeoGender: true,
  eeoRace: true,
  eeoEthnicity: true,
  eeoHispanicOrLatino: true,
  eeoVeteranStatus: true,
  eeoDisabilityStatus: true,
  updatedAt: true,
} satisfies Prisma.ProfileSelect;

/** The columns behind `portfolioSettingsSchema`. */
export const PORTFOLIO_SETTINGS_SELECT = {
  username: true,
  profile: {
    select: {
      availability: true,
      showResume: true,
      showWebsite: true,
      showLinkedin: true,
      showGithub: true,
    },
  },
} satisfies Prisma.UserSelect;

interface WithProfile {
  profile: object | null;
}

/** Spreads a user row's profile into it, so responses keep their flat shape. Profile fields win. */
export function withProfile<T extends WithProfile>(
  row: T,
): Omit<T, "profile"> & NonNullable<T["profile"]> {
  const { profile, ...account } = row;
  // Every user gets a profile at sign-up; a missing one is a broken row, not an empty profile.
  if (!profile) throw notFound("Profile not found");
  return { ...account, ...profile };
}
