import type { Data } from "@jobpilot/api-client";
import type { api } from "@/api/client";

/** The current user + active profile, inferred from `GET /api/auth/me`. */
export type MeResponse = Data<typeof api.auth.me.get>;
export type AuthUserDto = MeResponse["user"];

/** Login/register response (tokens are ignored — auth rides the httpOnly cookie). */
export type AuthSessionResponse = Data<typeof api.auth.login.post>;

export type LogoutResponse = Data<typeof api.auth.logout.post>;

/** Account-recovery responses (verify email, forgot/reset password, resend). */
export type VerifyEmailResponse = Data<typeof api.auth.email.verify.post>;
export type ResendVerificationResponse = Data<typeof api.auth.email.resend.post>;
export type ForgotPasswordResponse = Data<typeof api.auth.password.forgot.post>;
export type ResetPasswordResponse = Data<typeof api.auth.password.reset.post>;
