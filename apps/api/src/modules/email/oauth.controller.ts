import {
  type EmailConnectErrorReason,
  emailProviderQuery,
  emailProviderSchema,
  oauthClientUpsertSchema,
} from "@jobpilot/contracts/email";
import { Elysia } from "elysia";
import { z } from "zod/v4";
import { flowFailureReason, oauthStateCookies } from "@/common/auth";
import { container } from "@/common/di/container";
import { authGuard } from "@/common/middleware";
import { env } from "@/env";
import { okResponseSchema } from "@/types/response";
import { EmailAccountService } from "./account/account.service";
import { callbackQuery, oauthClientStatusSchema } from "./email.schema";

const account = container.get(EmailAccountService);

const OAUTH_COOKIE_PATH = "/api/email/oauth";
const STATE_COOKIES = { state: "email_oauth_state", companion: "email_oauth_binding" };
const bindingSchema = z.object({
  userId: z.string(),
  tokenId: z.string(),
  provider: emailProviderSchema,
  verifier: z.string().min(43),
  configHash: z.string(),
});

/** Bring-your-own mailbox OAuth client config + the connect (authorize/callback) flow. */
export const emailOAuthController = new Elysia({
  prefix: "/email",
  detail: { tags: ["Email"] },
})
  .use(authGuard)
  .get("/oauth/client", ({ user, query }) => account.getOAuthClient(user.id, query.provider), {
    query: emailProviderQuery,
    response: oauthClientStatusSchema,
    detail: {
      summary: "Get mailbox OAuth client config",
      description:
        "Returns whether the user has configured its own mailbox OAuth client, the client id, the redirect URI to register, and the requested scopes. Never returns the client secret.",
    },
  })
  .put("/oauth/client", ({ user, body }) => account.upsertOAuthClient(user.id, body), {
    body: oauthClientUpsertSchema,
    response: oauthClientStatusSchema,
    detail: {
      summary: "Set mailbox OAuth client config",
      description:
        "Creates or updates the user's mailbox OAuth client (encrypting the secret at rest). A blank client secret on edit keeps the stored one; it is required on first create.",
    },
  })
  .delete(
    "/oauth/client",
    ({ user, query }) => account.deleteOAuthClient(user.id, query.provider),
    {
      query: emailProviderQuery,
      response: okResponseSchema,
      detail: {
        summary: "Remove mailbox OAuth client config",
        description:
          "Removes the user's mailbox OAuth client. Returns 409 while a mailbox is still connected - disconnect it first.",
      },
    },
  )
  .get(
    "/oauth/start",
    async ({ user, query, cookie, redirect }) => {
      const { authorizeUrl, state, verifier, configHash } = await account.buildAuthorizeUrl(
        user.id,
        query.provider,
      );

      oauthStateCookies(cookie, STATE_COOKIES, OAUTH_COOKIE_PATH).set(
        state,
        JSON.stringify({
          userId: user.id,
          tokenId: user.tokenId,
          provider: query.provider,
          verifier,
          configHash,
        }),
      );
      return redirect(authorizeUrl);
    },
    {
      query: emailProviderQuery,
      detail: {
        summary: "Start mailbox OAuth flow",
        description:
          "Builds the provider authorize URL, stores the OAuth state in a short-lived cookie, and redirects the browser to provider's consent screen.",
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
      const fail = (reason: EmailConnectErrorReason) => back(`emailConnect=error&reason=${reason}`);

      const { code, reason } = stateCookies.checkCallback(query);
      if (reason) {
        return fail(reason);
      }

      let binding: z.infer<typeof bindingSchema>;
      try {
        binding = bindingSchema.parse(JSON.parse(stateCookies.companion() ?? "null"));
      } catch {
        return fail("invalid_callback");
      }
      if (binding.userId !== user.id || binding.tokenId !== user.tokenId)
        return fail("invalid_callback");
      stateCookies.clear();
      try {
        await account.completeEmailOAuth(
          user.id,
          code,
          binding.provider,
          binding.verifier,
          binding.configHash,
        );
      } catch (e) {
        return fail(flowFailureReason<EmailConnectErrorReason>(e, "Mailbox connect"));
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
