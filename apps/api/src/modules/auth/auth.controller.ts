import {
  ApiTokenCreateSchema,
  ForgotPasswordSchema,
  LoginSchema,
  RegisterSchema,
  ResetPasswordSchema,
  VerifyEmailSchema,
} from "@jobpilot/contracts";
import { idParam } from "@jobpilot/contracts/shared";
import { Elysia } from "elysia";
import { container } from "@/common/di";
import { logger } from "@/common/logger";
import { authGuard } from "@/common/middleware";
import { RATE_LIMITS, rateLimitHook } from "@/common/rate-limit";
import { okResponseSchema } from "@/types/response";
import { ApiTokenService } from "./api-token.service";
import { clearAuthCookies, REFRESH_COOKIE, setAuthCookies } from "./auth.cookies";
import {
  apiTokenListSchema,
  apiTokenMintedSchema,
  authSessionSchema,
  meSchema,
} from "./auth.schema";
import { AuthService } from "./auth.service";
import { VerificationService } from "./verification.service";

const authService = container.resolve(AuthService);
const verificationService = container.resolve(VerificationService);
const apiTokenService = container.resolve(ApiTokenService);

// One hook per route: each public route needs its own policy, and /me and /tokens/* stay unthrottled.
const limitRegister = rateLimitHook(RATE_LIMITS.register);
const limitLoginIp = rateLimitHook(RATE_LIMITS.loginPerIp);
const limitLoginAccount = rateLimitHook(RATE_LIMITS.loginPerAccount);
const limitRefresh = rateLimitHook(RATE_LIMITS.refresh);
const limitEmailVerify = rateLimitHook(RATE_LIMITS.emailVerify);
const limitForgotIp = rateLimitHook(RATE_LIMITS.forgotPerIp);
const limitForgotEmail = rateLimitHook(RATE_LIMITS.forgotPerEmail);
const limitPasswordReset = rateLimitHook(RATE_LIMITS.passwordReset);
const limitEmailResend = rateLimitHook(RATE_LIMITS.emailResend);

export const authController = new Elysia({ prefix: "/auth", detail: { tags: ["Auth"] } })
  // --- public ---
  .post(
    "/register",
    async ({ body, cookie }) => {
      const result = await authService.register(body);
      setAuthCookies(cookie, result.accessToken, result.refreshToken);
      // Confirm the address unless dev auto-verified it. Best-effort: a mail outage
      // shouldn't block account creation - the user can re-trigger from the gate.
      if (!result.user.emailVerified) {
        try {
          await verificationService.sendVerificationEmail(result.user.id, result.user.email);
        } catch (error) {
          logger.error({ err: error, userId: result.user.id }, "Failed to send verification email");
        }
      }
      return result;
    },
    {
      body: RegisterSchema,
      beforeHandle: limitRegister,
      response: authSessionSchema,
      detail: {
        summary: "Register a new account",
        description:
          "Creates a new user with an empty 1:1 profile, sets access and refresh token cookies, and returns the public user with freshly issued tokens.",
      },
    },
  )
  .post(
    "/login",
    async ({ body, cookie }) => {
      const result = await authService.login(body);
      setAuthCookies(cookie, result.accessToken, result.refreshToken);
      return result;
    },
    {
      body: LoginSchema,
      beforeHandle: [limitLoginIp, limitLoginAccount],
      response: authSessionSchema,
      detail: {
        summary: "Log in with credentials",
        description:
          "Verifies the email and password, sets access and refresh token cookies, and returns the public user with freshly issued tokens.",
      },
    },
  )
  .post(
    "/refresh",
    async ({ cookie }) => {
      const raw = cookie[REFRESH_COOKIE]?.value;
      const result = await authService.rotateRefresh(typeof raw === "string" ? raw : "");
      setAuthCookies(cookie, result.accessToken, result.refreshToken);
      return result;
    },
    {
      beforeHandle: limitRefresh,
      response: authSessionSchema,
      detail: {
        summary: "Rotate refresh token",
        description:
          "Validates the refresh token cookie, revokes the old refresh token, sets new access and refresh token cookies, and returns the public user with freshly issued tokens.",
      },
    },
  )
  .post(
    "/logout",
    async ({ cookie }) => {
      const raw = cookie[REFRESH_COOKIE]?.value;
      await authService.logout(typeof raw === "string" ? raw : "");
      clearAuthCookies(cookie);
      return { ok: true as const };
    },
    {
      response: okResponseSchema,
      detail: {
        summary: "Log out current session",
        description:
          "Revokes the refresh token from the cookie, clears the auth cookies, and returns an acknowledgement.",
      },
    },
  )
  .post("/email/verify", ({ body }) => verificationService.verifyEmail(body.token), {
    body: VerifyEmailSchema,
    beforeHandle: limitEmailVerify,
    response: okResponseSchema,
    detail: {
      summary: "Verify an email address",
      description:
        "Confirms an email address from a verification magic link by its token, marking the account verified. The token is single-use and expires.",
    },
  })
  .post("/password/forgot", ({ body }) => verificationService.requestPasswordReset(body.email), {
    body: ForgotPasswordSchema,
    beforeHandle: [limitForgotIp, limitForgotEmail],
    response: okResponseSchema,
    detail: {
      summary: "Request a password reset",
      description:
        "Sends a password-reset magic link to the address if an account exists. Always returns an acknowledgement and never reveals whether the email is registered.",
    },
  })
  .post(
    "/password/reset",
    ({ body }) => verificationService.resetPassword(body.token, body.password),
    {
      body: ResetPasswordSchema,
      beforeHandle: limitPasswordReset,
      response: okResponseSchema,
      detail: {
        summary: "Reset a password",
        description:
          "Sets a new password from a reset magic link by its token, consumes the token, and revokes all of the user's existing sessions.",
      },
    },
  )
  // --- authenticated ---
  .use(authGuard)
  .post("/email/resend", ({ user }) => verificationService.resendVerification(user.id), {
    beforeHandle: limitEmailResend,
    response: okResponseSchema,
    detail: {
      summary: "Resend the verification email",
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
  .get("/tokens", ({ user }) => apiTokenService.list(user.id), {
    response: apiTokenListSchema,
    detail: {
      summary: "List agent API tokens",
      description:
        "Returns the authenticated user's active (non-revoked) personal access tokens with their metadata, excluding the secret token values.",
    },
  })
  .post("/tokens", ({ user, body }) => apiTokenService.mint(user.id, body), {
    body: ApiTokenCreateSchema,
    response: apiTokenMintedSchema,
    detail: {
      summary: "Create agent API token",
      description:
        "Mints a new personal access token for the authenticated user and returns its details including the raw token, which is shown only once.",
    },
  })
  .post("/tokens/terminal", ({ user }) => apiTokenService.getOrCreateTerminalToken(user.id), {
    response: apiTokenMintedSchema,
    detail: {
      summary: "Get or create the agent terminal token",
      description:
        "Returns the authenticated user's single reusable terminal token, provisioning it on first use. The raw token is stored encrypted at rest, so the same value is returned on every call - the web sends it to the local terminal host on session start.",
    },
  })
  .delete("/tokens/:id", ({ user, params }) => apiTokenService.revoke(user.id, params.id), {
    params: idParam,
    response: okResponseSchema,
    detail: {
      summary: "Revoke agent API token",
      description:
        "Revokes the specified personal access token owned by the authenticated user and returns an acknowledgement.",
    },
  });
