import {
  availabilitySchema,
  portfolioVisibilitySchema,
  SALARY_CURRENCIES,
  SALARY_PERIODS,
} from "@jobpilot/contracts/user";
import { z } from "zod/v4";

/** A reference row attached to the user. */
const userReferenceSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  relationship: z.string().nullable(),
  company: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
});

/** A salary-preference row attached to the user. */
const userSalaryPreferenceSchema = z.object({
  id: z.uuid(),
  appliesTo: z.string(),
  minAmount: z.number().nullable(),
  maxAmount: z.number().nullable(),
  // Enums (not z.string()) keep Eden's inferred types aligned with the contracts input type.
  currency: z.enum(SALARY_CURRENCIES),
  period: z.enum(SALARY_PERIODS),
});

/** The user aggregate's scalar fields plus its parsed locations and references. */
const userViewSchema = z.object({
  id: z.uuid(),
  firstName: z.string(),
  lastName: z.string(),
  contactEmail: z.string(),
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
  references: z.array(userReferenceSchema),
  salaryPreferences: z.array(userSalaryPreferenceSchema),
  updatedAt: z.date(),
});

/** Persisted auto-apply settings (mirrors the `AutoApplySettings` row). */
const autoApplySettingsViewSchema = z.object({
  id: z.uuid(),
  userId: z.uuid(),
  minMatchScore: z.number().int(),
  maxApplicationsPerCampaign: z.number().int().nullable(),
  defaultStartDate: z.string(),
});

/** A row in the user's resume summary list. */
const userResumeSummarySchema = z.object({
  id: z.uuid(),
  label: z.string(),
  sourceFilename: z.string().nullable(),
  hasData: z.boolean(),
  variantCount: z.number().int(),
  isPrimary: z.boolean(),
  updatedAt: z.date(),
});

/** The full current-user aggregate returned by `GET /user`. */
export const userAggregateSchema = z.object({
  user: userViewSchema,
  autoApply: autoApplySettingsViewSchema.nullable(),
  primaryResumeSourceAbsolutePath: z.string().nullable(),
  resumes: z.array(userResumeSummarySchema),
});

/** Result of setting (or clearing) the user's primary resume. */
export const primaryResumeSetSchema = z.object({
  primaryResumeId: z.uuid().nullable(),
});

/** Current public-portfolio settings (from the `users` row). Username is always assigned. */
export const portfolioSettingsSchema = portfolioVisibilitySchema.extend({
  username: z.string(),
  availability: availabilitySchema.nullable(),
});

/** Whether a candidate username is free to claim. */
export const usernameAvailabilitySchema = z.object({
  available: z.boolean(),
});
