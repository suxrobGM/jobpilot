import { Elysia } from "elysia";
import { generateOpaqueToken, oauthStateCookies } from "@/common/auth";
import { container } from "@/common/di/container";
import { authGuard, resolveAuthUser } from "@/common/middleware";
import { RATE_LIMITS, rateLimit } from "@/common/rate-limit";
import { env } from "@/env";
import { okResponseSchema } from "@/types/response";
import { setAuthCookies } from "./auth.cookies";
import { oauthCallbackQuery, oauthProviderParams, oauthStartQuery } from "./auth.schema";
import { OAuthService } from "./oauth.service";

const oauthService = container.resolve(OAuthService);

const OAUTH_COOKIE_PATH = "/api/auth/providers";
const STATE_COOKIES = { state: "auth_oauth_state", companion: "auth_oauth_intent" };
const limitOAuth = rateLimit(RATE_LIMITS.oauthStart);

/** Google/GitHub sign-in, sign-up, and account linking with the shared app clients. */
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
        const reason = e instanceof Error ? e.message : "provider_not_configured";
        return redirect(`${env.APP_URL}/login?oauth=error&reason=${encodeURIComponent(reason)}`);
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
      // Failures surface as a query flag on the page the user came from.
      const errorPage = intent === "link" ? "/account/security" : "/login";
      const fail = (reason: string) => {
        stateCookies.clear();
        return redirect(
          `${env.APP_URL}${errorPage}?oauth=error&reason=${encodeURIComponent(reason)}`,
        );
      };

      if (query.error) {
        return fail(query.error);
      }
      if (!query.code || !query.state) {
        return fail("Missing code or state");
      }
      if (stateCookies.state() !== query.state) {
        return fail("OAuth state mismatch");
      }

      if (intent === "link") {
        const principal = await resolveAuthUser({ headers, cookie });
        if (!principal) {
          return fail("Session expired - sign in and try again");
        }
        try {
          await oauthService.link(principal.id, params.provider, query.code);
        } catch (e) {
          return fail(e instanceof Error ? e.message : "Failed to link account");
        }
        stateCookies.clear();
        return redirect(`${env.APP_URL}/account/security?oauth=linked&provider=${params.provider}`);
      }

      try {
        const result = await oauthService.handleLogin(params.provider, query.code);
        stateCookies.clear();
        setAuthCookies(cookie, result.accessToken, result.refreshToken);
        // Same landing as form login; the proxy bounces new users on to onboarding.
        return redirect(`${env.APP_URL}/workspace`);
      } catch (e) {
        return fail(e instanceof Error ? e.message : "Sign-in failed");
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
  // --- authenticated ---
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
