import { z } from "zod/v4";

// ── Response schemas ──────────────────────────────────────────────────────────

/** The public-safe view of a user (mirrors `publicUser`); `createdAt` is stringified. */
export const publicUserSchema = z.object({
  id: z.uuid(),
  email: z.string(),
  role: z.enum(["ADMIN", "USER"]),
  emailVerified: z.boolean(),
  createdAt: z.date(),
});

/** Auth result returned by register/login/refresh — public user plus a fresh token pair. */
export const authSessionSchema = z.object({
  user: publicUserSchema,
  accessToken: z.string(),
  refreshToken: z.string(),
});

/**
 * The raw `Profile` row returned alongside the user by `GET /me`.
 * The service returns the unmodified Prisma row, so `updatedAt` is a `Date`
 * (validated pre-serialization) and `preferredLocations` is the stored JSON string.
 */
export const meProfileSchema = z.object({
  id: z.uuid(),
  userId: z.uuid(),
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

/** Current user plus their associated profile (mirrors `AuthService.me`). */
export const meSchema = z.object({
  user: publicUserSchema,
  profile: meProfileSchema.nullable(),
});

/**
 * An active personal access token row (mirrors `ApiTokenService.list`'s select).
 * The service returns raw Prisma rows, so date fields are `Date` objects.
 */
export const apiTokenSummarySchema = z.object({
  id: z.uuid(),
  name: z.string(),
  lastUsedAt: z.date().nullable(),
  expiresAt: z.date().nullable(),
  createdAt: z.date(),
});

export const apiTokenListSchema = z.array(apiTokenSummarySchema);

/** A freshly minted token (mirrors `ApiTokenService.mint`) — the raw token is shown once. */
export const apiTokenMintedSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  token: z.string(),
  createdAt: z.date(),
});
