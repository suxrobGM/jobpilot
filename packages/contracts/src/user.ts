import { z } from "zod/v4";
import { optionalPhoneSchema } from "./phone";

const optionalUrl = z
  .union([z.literal(""), z.url("Must be a valid URL")])
  .optional()
  .nullable();

const optionalZipCode = z
  .union([
    z.literal(""),
    z
      .string()
      .regex(
        /^[A-Za-z0-9][A-Za-z0-9 -]{1,10}[A-Za-z0-9]$/,
        "Enter a valid ZIP or postal code (e.g. 94103 or SW1A 1AA)",
      ),
  ])
  .optional()
  .nullable();

const optionalLinkedinUrl = z
  .union([
    z.literal(""),
    z
      .url("Must be a valid URL")
      .regex(
        /^https?:\/\/([\w-]+\.)?linkedin\.com\/(in|pub|company)\/[\w\-%.]+\/?.*$/i,
        "Must be a LinkedIn profile URL (e.g. https://linkedin.com/in/your-handle)",
      ),
  ])
  .optional()
  .nullable();

const optionalGithubUrl = z
  .union([
    z.literal(""),
    z
      .url("Must be a valid URL")
      .regex(
        /^https?:\/\/([\w-]+\.)?github\.com\/[\w\-.]+\/?.*$/i,
        "Must be a GitHub profile URL (e.g. https://github.com/your-handle)",
      ),
  ])
  .optional()
  .nullable();

const optionalEmail = z
  .union([z.literal(""), z.email()])
  .optional()
  .nullable();

export const referenceSchema = z.object({
  name: z.string().min(1, "Required"),
  relationship: z.string().optional().nullable(),
  company: z.string().optional().nullable(),
  email: optionalEmail,
  phone: optionalPhoneSchema,
});

export type ReferenceInput = z.infer<typeof referenceSchema>;

export const SALARY_PERIODS = ["yearly", "hourly"] as const;

export type SalaryPeriod = (typeof SALARY_PERIODS)[number];

export const SALARY_CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD", "INR"] as const;

export type SalaryCurrency = (typeof SALARY_CURRENCIES)[number];

export const salaryPreferenceSchema = z.object({
  appliesTo: z.string().min(1, "Required"),
  minAmount: z.number().nonnegative().optional().nullable(),
  maxAmount: z.number().nonnegative().optional().nullable(),
  currency: z.enum(SALARY_CURRENCIES),
  period: z.enum(SALARY_PERIODS),
});

export type SalaryPreferenceInput = z.infer<typeof salaryPreferenceSchema>;

export const userUpdateSchema = z.object({
  firstName: z.string().min(1, "Required"),
  lastName: z.string().min(1, "Required"),
  contactEmail: z.email(),
  phone: optionalPhoneSchema,
  website: optionalUrl,
  linkedin: optionalLinkedinUrl,
  github: optionalGithubUrl,

  street: z.string().optional().nullable(),
  aptUnit: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  zipCode: optionalZipCode,
  country: z.string().optional().nullable(),

  usAuthorized: z.boolean(),
  requiresSponsorship: z.boolean(),
  visaStatus: z.string().optional().nullable(),
  optExtension: z.string().optional().nullable(),
  willingToRelocate: z.boolean(),
  preferredLocations: z.array(z.string()),
  references: z.array(referenceSchema).max(3),
  salaryPreferences: z.array(salaryPreferenceSchema).max(5),

  eeoGender: z.string().optional().nullable(),
  eeoRace: z.string().optional().nullable(),
  eeoEthnicity: z.string().optional().nullable(),
  eeoHispanicOrLatino: z.string().optional().nullable(),
  eeoVeteranStatus: z.string().optional().nullable(),
  eeoDisabilityStatus: z.string().optional().nullable(),

  primaryResumeId: z.uuid().nullable().optional(),
});

/** Auto-apply threshold when the user has not set one; also the fit scorer's fallback. */
export const DEFAULT_MIN_MATCH_SCORE = 60;

export const autoApplySettingsSchema = z.object({
  minMatchScore: z.number().int().min(0).max(100),
  maxApplicationsPerCampaign: z.number().int().min(1).max(500).optional().nullable(),
  defaultStartDate: z.string(),
});

export const userWithAutoApplySchema = userUpdateSchema.extend({
  autoApply: autoApplySettingsSchema.optional(),
});

/** Body for setting (or clearing, with `null`) the user's primary resume. */
export const setPrimaryResumeSchema = z.object({
  resumeId: z.uuid().nullable(),
});

export type UserWithAutoApplyInput = z.infer<typeof userWithAutoApplySchema>;

export const USER_DEFAULT_VALUES: UserWithAutoApplyInput = {
  firstName: "",
  lastName: "",
  contactEmail: "",
  phone: "",
  website: "",
  linkedin: "",
  github: "",
  street: "",
  aptUnit: "",
  city: "",
  state: "",
  zipCode: "",
  country: "United States",
  usAuthorized: true,
  requiresSponsorship: false,
  visaStatus: "",
  optExtension: "",
  willingToRelocate: false,
  preferredLocations: [],
  references: [],
  salaryPreferences: [],
  eeoGender: "Prefer not to disclose",
  eeoRace: "Prefer not to disclose",
  eeoEthnicity: "Prefer not to disclose",
  eeoHispanicOrLatino: "Prefer not to disclose",
  eeoVeteranStatus: "Prefer not to disclose",
  eeoDisabilityStatus: "Prefer not to disclose",
  primaryResumeId: null,
  autoApply: {
    minMatchScore: DEFAULT_MIN_MATCH_SCORE,
    maxApplicationsPerCampaign: null,
    defaultStartDate: "2 weeks notice",
  },
};

/** The /u/[username] slug. Lowercased; letters, digits, and interior hyphens only. */
export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "At least 3 characters")
  .max(30, "At most 30 characters")
  .regex(
    /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/,
    "Use letters, numbers, and hyphens (no leading/trailing hyphen)",
  );

export const availabilitySchema = z.enum(["open", "not_looking"]);

export type Availability = z.infer<typeof availabilitySchema>;

/** Coerce a raw nullable DB string to the availability enum, or null. The one place that guards it. */
export function parseAvailability(value: string | null): Availability | null {
  return value === null ? null : (availabilitySchema.safeParse(value).data ?? null);
}

/** What the owner has chosen to publish; every flag is opt-in. */
export const portfolioVisibilitySchema = z.object({
  showResume: z.boolean(),
  showWebsite: z.boolean(),
  showLinkedin: z.boolean(),
  showGithub: z.boolean(),
});

/** Partial update of the user's portfolio settings; every field optional. */
export const portfolioSettingsPatchSchema = portfolioVisibilitySchema.partial().extend({
  username: usernameSchema.optional(),
  availability: availabilitySchema.nullable().optional(),
});

export type PortfolioSettingsPatch = z.infer<typeof portfolioSettingsPatchSchema>;
