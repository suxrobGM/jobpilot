import {
  ForgotPasswordSchema,
  LoginSchema,
  RegisterSchema,
  ResetPasswordSchema,
  VerifyEmailSchema,
} from "@jobpilot/contracts/auth";
import { Elysia } from "elysia";
import { clearSessionCookie, readSessionCookie, setSessionCookie } from "@/common/auth";
import { container } from "@/common/di/container";
import { logger } from "@/common/logger";
import { authGuard } from "@/common/middleware";
import { RATE_LIMITS, rateLimit } from "@/common/rate-limit";
import { okResponseSchema } from "@/types/response";
import { authSessionSchema, meSchema, terminalTokenSchema } from "./auth.schema";
import { AuthService } from "./auth.service";
import { AuthTokenService } from "./auth-token.service";
import { VerificationService } from "./verification.service";

const authService = container.get(AuthService);
const verificationService = container.get(VerificationService);
const authTokens = container.get(AuthTokenService);

export const authController = new Elysia({ prefix: "/auth", detail: { tags: ["Auth"] } })
  .post(
    "/register",
    async ({ body, cookie }) => {
      const result = await authService.register(body);
      setSessionCookie(cookie, result.token);
      // Best-effort: a mail outage shouldn't block sign-up; the user can resend from the gate.
      if (!result.user.emailVerified) {
        try {
          await verificationService.sendVerificationEmail(result.user.id, result.user.email);
        } catch (error) {
          logger.error({ err: error, userId: result.user.id }, "Failed to send verification email");
        }
      }
      return { user: result.user };
    },
    {
      body: RegisterSchema,
      beforeHandle: rateLimit(RATE_LIMITS.register),
      response: authSessionSchema,
      detail: {
        summary: "Register a new account",
        description:
          "Creates a new user with empty profile fields, opens a session in the httpOnly `session` cookie, and returns the public user.",
      },
    },
  )
  .post(
    "/login",
    async ({ body, cookie }) => {
      const result = await authService.login(body);
      setSessionCookie(cookie, result.token);
      return { user: result.user };
    },
    {
      body: LoginSchema,
      beforeHandle: [rateLimit(RATE_LIMITS.loginPerIp), rateLimit(RATE_LIMITS.loginPerAccount)],
      response: authSessionSchema,
      detail: {
        summary: "Log in with credentials",
        description:
          "Verifies the email and password, opens a session in the httpOnly `session` cookie, and returns the public user.",
      },
    },
  )
  .post(
    "/logout",
    async ({ cookie }) => {
      await authService.logout(readSessionCookie(cookie));
      clearSessionCookie(cookie);
      return { ok: true as const };
    },
    {
      response: okResponseSchema,
      detail: {
        summary: "Log out current session",
        description:
          "Revokes the session from the cookie, clears the cookie, and returns an acknowledgement.",
      },
    },
  )
  .post("/email/verification/confirm", ({ body }) => verificationService.verifyEmail(body.token), {
    body: VerifyEmailSchema,
    beforeHandle: rateLimit(RATE_LIMITS.emailVerify),
    response: okResponseSchema,
    detail: {
      summary: "Verify an email address",
      description:
        "Confirms an email address from a verification magic link by its token, marking the account verified. The token is single-use and expires.",
    },
  })
  .post("/password/reset", ({ body }) => verificationService.requestPasswordReset(body.email), {
    body: ForgotPasswordSchema,
    beforeHandle: [rateLimit(RATE_LIMITS.forgotPerIp), rateLimit(RATE_LIMITS.forgotPerEmail)],
    response: okResponseSchema,
    detail: {
      summary: "Request a password reset",
      description:
        "Sends a password-reset magic link to the address if an account exists. Always returns an acknowledgement and never reveals whether the email is registered.",
    },
  })
  .post(
    "/password/reset/confirm",
    ({ body }) => verificationService.resetPassword(body.token, body.password),
    {
      body: ResetPasswordSchema,
      beforeHandle: rateLimit(RATE_LIMITS.passwordReset),
      response: okResponseSchema,
      detail: {
        summary: "Reset a password",
        description:
          "Sets a new password from a reset magic link by its token, consumes the token, and revokes all of the user's existing sessions.",
      },
    },
  )
  .use(authGuard)
  .post("/email/verification", ({ user }) => verificationService.resendVerification(user.id), {
    beforeHandle: rateLimit(RATE_LIMITS.emailResend),
    response: okResponseSchema,
    detail: {
      summary: "Send the verification email",
      description:
        "Re-sends the verification magic link to the authenticated user's email if it is not already verified.",
    },
  })
  .get("/me", ({ user }) => authService.me(user.id), {
    response: meSchema,
    detail: {
      summary: "Get current user",
      description:
        "Returns the authenticated user's public account details along with their associated profile.",
    },
  })
  .post("/tokens/terminal", ({ user }) => authTokens.getOrCreateTerminalToken(user.id), {
    response: terminalTokenSchema,
    detail: {
      summary: "Get or create the agent terminal token",
      description:
        "Returns the authenticated user's single reusable terminal token, provisioning it on first use. The raw token is stored encrypted at rest, so the same value is returned on every call - the web sends it to the local terminal host on session start.",
    },
  });
