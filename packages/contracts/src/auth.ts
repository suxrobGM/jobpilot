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

/** Every bearer credential kind: a web session (cookie) or the agent's terminal token. */
export const AUTH_TOKEN_KINDS = ["session", "terminal"] as const;

export const OAUTH_PROVIDERS = ["google", "github"] as const;
export const OAuthProviderSchema = z.enum(OAUTH_PROVIDERS);

/** Every reason the sign-in OAuth callback redirects back with (`?oauth=error&reason=`). */
const OAUTH_ERROR_REASONS = [
  "provider_not_configured",
  "email_unverified",
  "access_denied",
  /** The provider reported a failure or returned an unusable profile. */
  "provider_error",
  /** Missing code or state, or the state cookie did not match. */
  "invalid_callback",
  /** A link callback arrived without a live session. */
  "session_expired",
  /** That provider identity is linked to another JobPilot account. */
  "identity_taken",
  /** This account already has an identity from that provider. */
  "provider_already_linked",
  "unexpected",
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

export const DeleteAccountSchema = z.object({
  currentPassword: z.string().optional(),
});

export const ConfirmEmailChangeSchema = z.object({
  token: z.string().min(1),
});

export type LoginInput = z.infer<typeof LoginSchema>;
export type RegisterInput = z.infer<typeof RegisterSchema>;
export type VerifyEmailInput = z.infer<typeof VerifyEmailSchema>;
export type ForgotPasswordInput = z.infer<typeof ForgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>;
export type OAuthProviderInput = z.infer<typeof OAuthProviderSchema>;
export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>;
export type ChangeEmailInput = z.infer<typeof ChangeEmailSchema>;
export type ConfirmEmailChangeInput = z.infer<typeof ConfirmEmailChangeSchema>;
export type DeleteAccountInput = z.infer<typeof DeleteAccountSchema>;
