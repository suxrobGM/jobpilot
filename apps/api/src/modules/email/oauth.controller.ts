import { oauthClientUpsertSchema } from "@jobpilot/contracts/email";
import { Elysia } from "elysia";
import { container } from "@/common/di";
import { profileGuard } from "@/common/middleware";
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

/** Bring-your-own Google OAuth client config + the connect (authorize/callback) flow. */
export const emailOAuthController = new Elysia({
  detail: { tags: ["Email"] },
})
  .use(profileGuard)
  // --- OAuth client config (bring-your-own Google app) -----------------------
  .get("/oauth/client", ({ profileId }) => account.getOAuthClient(profileId), {
    response: oauthClientStatusSchema,
    detail: {
      summary: "Get mailbox OAuth client config",
      description:
        "Returns whether the profile has configured its own Google OAuth client, the client id, the redirect URI to register, and the requested scopes. Never returns the client secret.",
    },
  })
  .put(
    "/oauth/client",
    ({ user, profileId, body }) => account.upsertOAuthClient(user.id, profileId, body),
    {
      body: oauthClientUpsertSchema,
      response: oauthClientStatusSchema,
      detail: {
        summary: "Set mailbox OAuth client config",
        description:
          "Creates or updates the profile's Google OAuth client (encrypting the secret at rest). A blank client secret on edit keeps the stored one; it is required on first create.",
      },
    },
  )
  .delete("/oauth/client", ({ profileId }) => account.deleteOAuthClient(profileId), {
    response: oauthClientDeletedSchema,
    detail: {
      summary: "Remove mailbox OAuth client config",
      description:
        "Removes the profile's Google OAuth client. Returns 409 while a mailbox is still connected — disconnect it first.",
    },
  })
  // --- Connect flow ----------------------------------------------------------
  .get(
    "/oauth/start",
    async ({ user, profileId, query, cookie, redirect }) => {
      const providerName = query.provider ?? "gmail";
      const { authorizeUrl, state } = await account.buildAuthorizeUrl(
        user.id,
        profileId,
        providerName,
      );

      cookie.email_oauth_state!.set({
        value: state,
        httpOnly: true,
        sameSite: "lax",
        path: OAUTH_COOKIE_PATH,
        maxAge: 600,
      });
      cookie.email_oauth_provider!.set({
        value: providerName,
        httpOnly: true,
        sameSite: "lax",
        path: OAUTH_COOKIE_PATH,
        maxAge: 600,
      });

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
    async ({ user, profileId, query, cookie, redirect }) => {
      // Clear the OAuth cookies and bounce back to the app, surfacing failures as a flag the UI toasts.
      const clearCookies = () => {
        cookie.email_oauth_state!.set({ value: "", path: OAUTH_COOKIE_PATH, maxAge: 0 });
        cookie.email_oauth_provider!.set({ value: "", path: OAUTH_COOKIE_PATH, maxAge: 0 });
      };
      const back = (params: string) => {
        clearCookies();
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

      const expectedState = cookie.email_oauth_state?.value;
      const providerName =
        (typeof cookie.email_oauth_provider?.value === "string"
          ? cookie.email_oauth_provider.value
          : undefined) ?? "gmail";
      if (!expectedState || expectedState !== query.state) {
        return fail("OAuth state mismatch");
      }

      try {
        await account.completeEmailOAuth({
          providerName,
          code: query.code,
          userId: user.id,
          profileId,
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
