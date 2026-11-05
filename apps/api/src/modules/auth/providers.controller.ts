import type { OAuthErrorReason } from "@jobpilot/contracts/auth";
import { Elysia } from "elysia";
import {
  flowFailureReason,
  generateOpaqueToken,
  oauthStateCookies,
  setSessionCookie,
} from "@/common/auth";
import { container } from "@/common/di/container";
import { authGuard, resolveAuthUser } from "@/common/middleware";
import { RATE_LIMITS, rateLimit } from "@/common/rate-limit";
import { env } from "@/env";
import { okResponseSchema } from "@/types/response";
import { oauthCallbackQuery, oauthProviderParams, oauthStartQuery } from "./auth.schema";
import { OAuthService } from "./oauth.service";

const oauthService = container.get(OAuthService);

const OAUTH_COOKIE_PATH = "/api/auth/providers";
const STATE_COOKIES = { state: "auth_oauth_state", companion: "auth_oauth_intent" };
const limitOAuth = rateLimit(RATE_LIMITS.oauthStart);

export const authProvidersController = new Elysia({
  prefix: "/auth/providers",
  detail: { tags: ["Auth"] },
})
  .get(
    "/:provider/authorize",
    async ({ params, query, headers, cookie, redirect }) => {
      const principal = await resolveAuthUser({ headers, cookie });

      // Link re-verifies the session cookie so a forged redirect can't retarget the identity.
      if (query.intent === "link" && !principal) {
        return redirect(`${env.APP_URL}/login`);
      }

      const state = generateOpaqueToken();
      let authorizeUrl: string;
      try {
        authorizeUrl = oauthService.getAuthorizeUrl(params.provider, state);
      } catch (e) {
        const reason = flowFailureReason<OAuthErrorReason>(e, "OAuth sign-in start");
        return redirect(`${env.APP_URL}/login?oauth=error&reason=${reason}`);
      }

      oauthStateCookies(cookie, STATE_COOKIES, OAUTH_COOKIE_PATH).set(state, query.intent);
      return redirect(authorizeUrl);
    },
    {
      params: oauthProviderParams,
      query: oauthStartQuery,
      beforeHandle: limitOAuth,
      detail: {
        summary: "Start OAuth sign-in or linking",
        description:
          "Stores the CSRF state and intent in short-lived cookies and redirects the browser to the provider's consent screen. `intent=link` attaches the identity to the signed-in account instead of signing in, and requires a valid session.",
      },
    },
  )
  .get(
    "/:provider/callback",
    async ({ params, query, headers, cookie, redirect }) => {
      const stateCookies = oauthStateCookies(cookie, STATE_COOKIES, OAUTH_COOKIE_PATH);
      const intent = stateCookies.companion() === "link" ? "link" : "login";
      const errorPage = intent === "link" ? "/settings/security" : "/login";
      const fail = (reason: OAuthErrorReason) => {
        stateCookies.clear();
        return redirect(`${env.APP_URL}${errorPage}?oauth=error&reason=${reason}`);
      };

      const { code, reason } = stateCookies.checkCallback(query);
      if (reason) {
        return fail(reason);
      }

      if (intent === "link") {
        const principal = await resolveAuthUser({ headers, cookie });
        if (!principal) {
          return fail("session_expired");
        }
        try {
          await oauthService.link(principal.id, params.provider, code);
        } catch (e) {
          return fail(flowFailureReason<OAuthErrorReason>(e, "OAuth link"));
        }
        stateCookies.clear();
        return redirect(
          `${env.APP_URL}/settings/security?oauth=linked&provider=${params.provider}`,
        );
      }

      try {
        const result = await oauthService.handleLogin(params.provider, code);
        stateCookies.clear();
        setSessionCookie(cookie, result.token);
        // Same landing as form login; the proxy bounces new users on to onboarding.
        return redirect(`${env.APP_URL}/workspace`);
      } catch (e) {
        return fail(flowFailureReason<OAuthErrorReason>(e, "OAuth sign-in"));
      }
    },
    {
      params: oauthProviderParams,
      query: oauthCallbackQuery,
      beforeHandle: limitOAuth,
      detail: {
        summary: "Complete OAuth callback",
        description:
          "Validates the CSRF state cookie, exchanges the authorization code, then signs in (creating or auto-linking an account with a provider-verified email) or links the identity to the current session, and redirects back to the app.",
      },
    },
  )
  .use(authGuard)
  .delete("/:provider", ({ user, params }) => oauthService.unlink(user.id, params.provider), {
    params: oauthProviderParams,
    response: okResponseSchema,
    detail: {
      summary: "Unlink an OAuth provider",
      description:
        "Removes the linked provider identity from the authenticated account. Refused while it is the account's only sign-in method (no password and no other provider).",
    },
  });
