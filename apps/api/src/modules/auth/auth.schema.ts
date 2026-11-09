import { OAuthProviderSchema } from "@jobpilot/contracts/auth";
import { roleSchema } from "@jobpilot/contracts/role";
import { availabilitySchema } from "@jobpilot/contracts/user";
import { z } from "zod/v4";

export const oauthProviderParams = z.object({ provider: OAuthProviderSchema });

export const oauthStartQuery = z.object({
  intent: z.enum(["login", "link"]).default("login"),
});

export const oauthCallbackQuery = z.object({
  code: z.string().optional(),
  state: z.string().optional(),
  error: z.string().optional(),
});

/** The public-safe view of a user (mirrors `publicUser`); `createdAt` is stringified. */
export const publicUserSchema = z.object({
  id: z.uuid(),
  email: z.string(),
  role: roleSchema,
  emailVerified: z.boolean(),
  createdAt: z.date(),
});

/** Register/login result: the public user. The session itself rides the httpOnly cookie. */
export const authSessionSchema = z.object({
  user: publicUserSchema,
});

/**
 * The signed-in user's own merged view (mirrors `meUser`): account fields plus
 * the applicant profile columns. `contactEmail` is the applicant address; `email`
 * stays the login address. `updatedAt` is a `Date` (validated pre-serialization).
 */
export const meSchema = publicUserSchema.extend({
  // Sign-in methods for the account security page; the hash itself never leaves the API.
  hasPassword: z.boolean(),
  providers: z.array(z.enum(["google", "github"])),
  username: z.string(),
  availability: availabilitySchema.nullable(),
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
  updatedAt: z.date(),
});

/** The agent's reusable terminal token (mirrors `AuthTokenService.getOrCreateTerminalToken`). */
export const terminalTokenSchema = z.object({
  id: z.uuid(),
  token: z.string(),
  createdAt: z.date(),
});
