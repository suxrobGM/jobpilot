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
import { authGuard } from "@/common/middleware";
import { clearAuthCookies, REFRESH_COOKIE, setAuthCookies } from "./auth.cookies";
import { AuthService } from "./auth.service";

const authService = container.resolve(AuthService);

export const authController = new Elysia({ prefix: "/auth", detail: { tags: ["Auth"] } })
  // --- public ---
  .post(
    "/register",
    async ({ body, cookie }) => {
      const result = await authService.register(body);
      setAuthCookies(cookie, result.accessToken, result.refreshToken);
      return result;
    },
    {
      body: RegisterSchema,
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
      return { ok: true };
    },
    {
      detail: {
        summary: "Log out current session",
        description:
          "Revokes the refresh token from the cookie, clears the auth cookies, and returns an acknowledgement.",
      },
    },
  )
  .post("/email/verify", ({ body }) => authService.verifyEmail(body.token), {
    body: VerifyEmailSchema,
    detail: {
      summary: "Verify an email address",
      description:
        "Confirms an email address from a verification magic link by its token, marking the account verified. The token is single-use and expires.",
    },
  })
  .post("/password/forgot", ({ body }) => authService.requestPasswordReset(body.email), {
    body: ForgotPasswordSchema,
    detail: {
      summary: "Request a password reset",
      description:
        "Sends a password-reset magic link to the address if an account exists. Always returns an acknowledgement and never reveals whether the email is registered.",
    },
  })
  .post("/password/reset", ({ body }) => authService.resetPassword(body.token, body.password), {
    body: ResetPasswordSchema,
    detail: {
      summary: "Reset a password",
      description:
        "Sets a new password from a reset magic link by its token, consumes the token, and revokes all of the user's existing sessions.",
    },
  })
  // --- authenticated ---
  .use(authGuard)
  .post("/email/resend", ({ user }) => authService.resendVerification(user.id), {
    detail: {
      summary: "Resend the verification email",
      description:
        "Re-sends the verification magic link to the authenticated user's email if it is not already verified.",
    },
  })
  .get("/me", ({ user }) => authService.me(user.id), {
    detail: {
      summary: "Get current user",
      description:
        "Returns the authenticated user's public account details along with their associated profile.",
    },
  })
  .get("/tokens", ({ user }) => authService.listApiTokens(user.id), {
    detail: {
      summary: "List agent API tokens",
      description:
        "Returns the authenticated user's active (non-revoked) personal access tokens with their metadata, excluding the secret token values.",
    },
  })
  .post("/tokens", ({ user, body }) => authService.mintApiToken(user.id, body), {
    body: ApiTokenCreateSchema,
    detail: {
      summary: "Create agent API token",
      description:
        "Mints a new personal access token for the authenticated user and returns its details including the raw token, which is shown only once.",
    },
  })
  .delete("/tokens/:id", ({ user, params }) => authService.revokeApiToken(user.id, params.id), {
    params: idParam,
    detail: {
      summary: "Revoke agent API token",
      description:
        "Revokes the specified personal access token owned by the authenticated user and returns an acknowledgement.",
    },
  });
