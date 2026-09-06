import { z } from "zod/v4";

/**
 * Strong-password policy shared by registration and password reset: at least
 * 8 characters spanning four character classes (upper, lower, number, symbol).
 * Login intentionally stays lax (`min(1)`) so existing accounts can still sign
 * in - the policy is only enforced when a password is set.
 */
const PasswordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[a-z]/, "Password must include a lowercase letter")
  .regex(/[A-Z]/, "Password must include an uppercase letter")
  .regex(/[0-9]/, "Password must include a number")
  .regex(/[^A-Za-z0-9]/, "Password must include a special character");

export const LoginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

export const RegisterSchema = z.object({
  email: z.email(),
  password: PasswordSchema,
});

export const ApiTokenCreateSchema = z.object({
  name: z.string().min(1).max(100),
});

export const VerifyEmailSchema = z.object({
  token: z.string().min(1),
});

export const ForgotPasswordSchema = z.object({
  email: z.email(),
});

export const ResetPasswordSchema = z.object({
  token: z.string().min(1),
  password: PasswordSchema,
});

/** Wire values for sign-in providers (lowercase; the API maps to the Prisma enum). */
export const OAuthProviderSchema = z.enum(["google", "github"]);

/** Machine reasons the OAuth callback can redirect back with (`?oauth=error&reason=`).
 *  Other reasons are provider prose (e.g. GitHub's error_description) shown as-is. */
const OAUTH_ERROR_REASONS = [
  "provider_not_configured",
  "email_unverified",
  "access_denied",
] as const;
export type OAuthErrorReason = (typeof OAUTH_ERROR_REASONS)[number];

/** currentPassword is required by the service iff the account has one; "" counts as absent. */
export const ChangePasswordSchema = z.object({
  currentPassword: z.string().optional(),
  newPassword: PasswordSchema,
});

export const ChangeEmailSchema = z.object({
  newEmail: z.email(),
  currentPassword: z.string().optional(),
});

export const ConfirmEmailChangeSchema = z.object({
  token: z.string().min(1),
});

export type LoginInput = z.infer<typeof LoginSchema>;
export type RegisterInput = z.infer<typeof RegisterSchema>;
export type ApiTokenCreateInput = z.infer<typeof ApiTokenCreateSchema>;
export type VerifyEmailInput = z.infer<typeof VerifyEmailSchema>;
export type ForgotPasswordInput = z.infer<typeof ForgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>;
export type OAuthProviderInput = z.infer<typeof OAuthProviderSchema>;
export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>;
export type ChangeEmailInput = z.infer<typeof ChangeEmailSchema>;
export type ConfirmEmailChangeInput = z.infer<typeof ConfirmEmailChangeSchema>;
