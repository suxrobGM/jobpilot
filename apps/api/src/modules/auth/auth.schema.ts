import { OAuthProviderSchema } from "@jobpilot/contracts";
import { roleSchema } from "@jobpilot/contracts/role";
import { z } from "zod/v4";

// Request schemas (OAuth sign-in flow)

export const oauthProviderParams = z.object({ provider: OAuthProviderSchema });

export const oauthStartQuery = z.object({
  intent: z.enum(["login", "link"]).default("login"),
});

export const oauthCallbackQuery = z.object({
  code: z.string().optional(),
  state: z.string().optional(),
  error: z.string().optional(),
});

// Response schemas

/** The public-safe view of a user (mirrors `publicUser`); `createdAt` is stringified. */
export const publicUserSchema = z.object({
  id: z.uuid(),
  email: z.string(),
  role: roleSchema,
  emailVerified: z.boolean(),
  createdAt: z.date(),
});

/** Auth result returned by register/login/refresh - public user plus a fresh token pair. */
export const authSessionSchema = z.object({
  user: publicUserSchema,
  accessToken: z.string(),
  refreshToken: z.string(),
});

/**
 * The signed-in user's own merged view (mirrors `meUser`): account fields plus
 * the applicant profile columns. `contactEmail` is the applicant address; `email`
 * stays the login address. `updatedAt` is a `Date` (validated pre-serialization)
 * and `preferredLocations` is the stored JSON string.
 */
export const meSchema = publicUserSchema.extend({
  // Sign-in methods for the account security page; the hash itself never leaves the API.
  hasPassword: z.boolean(),
  providers: z.array(z.enum(["google", "github"])),
  username: z.string(),
  availability: z.string().nullable(),
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
  preferredLocations: z.string(),
  eeoGender: z.string().nullable(),
  eeoRace: z.string().nullable(),
  eeoEthnicity: z.string().nullable(),
  eeoHispanicOrLatino: z.string().nullable(),
  eeoVeteranStatus: z.string().nullable(),
  eeoDisabilityStatus: z.string().nullable(),
  primaryResumeId: z.uuid().nullable(),
  updatedAt: z.date(),
});

/**
 * An active personal access token row (mirrors `ApiTokenService.list`'s select).
 * The service returns raw Prisma rows, so date fields are `Date` objects.
 */
const apiTokenSummarySchema = z.object({
  id: z.uuid(),
  name: z.string(),
  lastUsedAt: z.date().nullable(),
  expiresAt: z.date().nullable(),
  createdAt: z.date(),
});

export const apiTokenListSchema = z.array(apiTokenSummarySchema);

/** A freshly minted token (mirrors `ApiTokenService.mint`) - the raw token is shown once. */
export const apiTokenMintedSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  token: z.string(),
  createdAt: z.date(),
});
