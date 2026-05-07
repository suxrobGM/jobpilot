import { z } from "zod/v4";

export const profileSchema = z.object({
  firstName: z.string().min(1, "Required"),
  lastName: z.string().min(1, "Required"),
  email: z.email(),
  phone: z.string().optional().nullable(),
  website: z.string().optional().nullable(),
  linkedin: z.string().optional().nullable(),
  github: z.string().optional().nullable(),

  street: z.string().optional().nullable(),
  aptUnit: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  zipCode: z.string().optional().nullable(),
  country: z.string().optional().nullable(),

  usAuthorized: z.boolean(),
  requiresSponsorship: z.boolean(),
  visaStatus: z.string().optional().nullable(),
  optExtension: z.string().optional().nullable(),
  willingToRelocate: z.boolean(),
  preferredLocations: z.array(z.string()),

  eeoGender: z.string().optional().nullable(),
  eeoRace: z.string().optional().nullable(),
  eeoEthnicity: z.string().optional().nullable(),
  eeoHispanicOrLatino: z.string().optional().nullable(),
  eeoVeteranStatus: z.string().optional().nullable(),
  eeoDisabilityStatus: z.string().optional().nullable(),

  defaultResumeId: z.number().int().nullable().optional(),
});

export type ProfileInput = z.infer<typeof profileSchema>;

export const autopilotSettingsSchema = z.object({
  minMatchScore: z.number().int().min(0).max(10),
  maxApplicationsPerRun: z.number().int().min(1).max(500),
  confirmMode: z.enum(["batch", "auto"]),
  skipCompanies: z.array(z.string()),
  skipTitleKeywords: z.array(z.string()),
  minSalary: z.number().int().min(0),
  maxSalary: z.number().int().min(0),
  salaryExpectation: z.string().optional().nullable(),
  defaultStartDate: z.string(),
});

export type AutopilotSettingsInput = z.infer<typeof autopilotSettingsSchema>;

export const profileWithAutopilotSchema = profileSchema.extend({
  autopilot: autopilotSettingsSchema.optional(),
});

export type ProfileWithAutopilotInput = z.infer<typeof profileWithAutopilotSchema>;
