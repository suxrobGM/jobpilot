import { z } from "zod/v4";

// ── Response schemas ──────────────────────────────────────────────────────────

/** A reference row attached to the profile. */
export const profileReferenceSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  relationship: z.string().nullable(),
  company: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
});

/** The profile aggregate's scalar fields plus its parsed locations and references. */
export const profileViewSchema = z.object({
  id: z.uuid(),
  firstName: z.string(),
  lastName: z.string(),
  email: z.string(),
  phone: z.string().nullable(),
  website: z.string().nullable(),
  linkedin: z.string().nullable(),
  github: z.string().nullable(),
  street: z.string().nullable(),
  aptUnit: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  zipCode: z.string().nullable(),
  country: z.string().nullable(),
  usAuthorized: z.boolean(),
  requiresSponsorship: z.boolean(),
  visaStatus: z.string().nullable(),
  optExtension: z.string().nullable(),
  willingToRelocate: z.boolean(),
  preferredLocations: z.array(z.string()),
  eeoGender: z.string().nullable(),
  eeoRace: z.string().nullable(),
  eeoEthnicity: z.string().nullable(),
  eeoHispanicOrLatino: z.string().nullable(),
  eeoVeteranStatus: z.string().nullable(),
  eeoDisabilityStatus: z.string().nullable(),
  primaryResumeId: z.uuid().nullable(),
  references: z.array(profileReferenceSchema),
  updatedAt: z.date(),
});

/** Persisted auto-apply settings (mirrors the `AutoApplySettings` row). */
export const autoApplySettingsViewSchema = z.object({
  id: z.uuid(),
  profileId: z.uuid(),
  minMatchScore: z.number().int(),
  maxApplicationsPerCampaign: z.number().int().nullable(),
  defaultStartDate: z.string(),
});

/** A row in the profile's resume summary list. */
export const profileResumeSummarySchema = z.object({
  id: z.uuid(),
  label: z.string(),
  sourceFilename: z.string().nullable(),
  hasData: z.boolean(),
  variantCount: z.number().int(),
  isPrimary: z.boolean(),
  updatedAt: z.date(),
});

/** The full active-profile aggregate returned by `GET /profile`. */
export const profileAggregateSchema = z.object({
  profile: profileViewSchema,
  autoApply: autoApplySettingsViewSchema.nullable(),
  primaryResumeSourceAbsolutePath: z.string().nullable(),
  resumes: z.array(profileResumeSummarySchema),
});

/** Result of setting (or clearing) the profile's primary resume. */
export const primaryResumeSetSchema = z.object({
  primaryResumeId: z.uuid().nullable(),
});
