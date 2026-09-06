import { oauthClientUpsertSchema } from "@jobpilot/contracts/email";
import { Elysia } from "elysia";
import { oauthStateCookies } from "@/common/auth";
import { container } from "@/common/di/container";
import { authGuard } from "@/common/middleware";
import { env } from "@/env";
import { EmailAccountService } from "./account/account.service";
import {
  callbackQuery,
  oauthClientDeletedSchema,
  oauthClientStatusSchema,
  startQuery,
} from "./email.schema";

const account = container.resolve(EmailAccountService);

const OAUTH_COOKIE_PATH = "/api/email/oauth";
const STATE_COOKIES = { state: "email_oauth_state", companion: "email_oauth_provider" };

/** Bring-your-own Google OAuth client config + the connect (authorize/callback) flow. */
export const emailOAuthController = new Elysia({
  prefix: "/email",
  detail: { tags: ["Email"] },
})
  .use(authGuard)
  // --- OAuth client config (bring-your-own Google app) -----------------------
  .get("/oauth/client", ({ user }) => account.getOAuthClient(user.id), {
    response: oauthClientStatusSchema,
    detail: {
      summary: "Get mailbox OAuth client config",
      description:
        "Returns whether the profile has configured its own Google OAuth client, the client id, the redirect URI to register, and the requested scopes. Never returns the client secret.",
    },
  })
  .put("/oauth/client", ({ user, body }) => account.upsertOAuthClient(user.id, body), {
    body: oauthClientUpsertSchema,
    response: oauthClientStatusSchema,
    detail: {
      summary: "Set mailbox OAuth client config",
      description:
        "Creates or updates the profile's Google OAuth client (encrypting the secret at rest). A blank client secret on edit keeps the stored one; it is required on first create.",
    },
  })
  .delete("/oauth/client", ({ user }) => account.deleteOAuthClient(user.id), {
    response: oauthClientDeletedSchema,
    detail: {
      summary: "Remove mailbox OAuth client config",
      description:
        "Removes the profile's Google OAuth client. Returns 409 while a mailbox is still connected - disconnect it first.",
    },
  })
  // --- Connect flow ----------------------------------------------------------
  .get(
    "/oauth/start",
    async ({ user, query, cookie, redirect }) => {
      const providerName = query.provider ?? "gmail";
      const { authorizeUrl, state } = await account.buildAuthorizeUrl(user.id, providerName);

      oauthStateCookies(cookie, STATE_COOKIES, OAUTH_COOKIE_PATH).set(state, providerName);
      return redirect(authorizeUrl);
    },
    {
      query: startQuery,
      detail: {
        summary: "Start mailbox OAuth flow",
        description:
          "Builds the provider authorize URL, stores the OAuth state and provider in short-lived cookies, and redirects the browser to the provider's consent screen.",
      },
    },
  )
  .get(
    "/oauth/callback",
    async ({ user, query, cookie, redirect }) => {
      // Clear the OAuth cookies and bounce back to the app, surfacing failures as a flag the UI toasts.
      const stateCookies = oauthStateCookies(cookie, STATE_COOKIES, OAUTH_COOKIE_PATH);
      const back = (params: string) => {
        stateCookies.clear();
        return redirect(`${env.APP_URL}/inbox?${params}`);
      };
      const fail = (reason: string) =>
        back(`emailConnect=error&reason=${encodeURIComponent(reason)}`);

      if (query.error) {
        return fail(query.error);
      }
      if (!query.code || !query.state) {
        return fail("Missing code or state");
      }

      const providerName = stateCookies.companion() ?? "gmail";
      if (stateCookies.state() !== query.state) {
        return fail("OAuth state mismatch");
      }

      try {
        await account.completeEmailOAuth({
          providerName,
          code: query.code,
          userId: user.id,
        });
      } catch (e) {
        return fail(e instanceof Error ? e.message : "Failed to connect mailbox");
      }

      return back("emailConnect=ok");
    },
    {
      query: callbackQuery,
      detail: {
        summary: "Complete mailbox OAuth callback",
        description:
          "Validates the OAuth state cookie, exchanges the authorization code to connect the mailbox account, clears the OAuth cookies, and redirects the browser back to the inbox page.",
      },
    },
  );
