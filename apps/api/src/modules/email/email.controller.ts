import { approveSchema, scanMessageSchema } from "@jobpilot/contracts/email";
import { sendEmailSchema } from "@jobpilot/contracts/outreach";
import { idParam } from "@jobpilot/contracts/shared";
import { Elysia, sse } from "elysia";
import { container } from "@/common/di";
import { badRequest, ErrorCodes, HttpError } from "@/common/errors";
import { profileGuard } from "@/common/middleware";
import { subscribe } from "@/common/sse";
import { inboxChannel } from "@/common/sse/channels/inbox";
import { env } from "@/env";
import { EmailAccountService } from "./account/account.service";
import { callbackQuery, messagesQuery, startQuery } from "./email.schema";
import { EmailService } from "./email.service";
import { EmailSyncService } from "./sync/sync.service";

const svc = container.resolve(EmailService);
const account = container.resolve(EmailAccountService);
const sync = container.resolve(EmailSyncService);

const OAUTH_COOKIE_PATH = "/api/email/oauth";

export const emailController = new Elysia({
  prefix: "/email",
  detail: { tags: ["Email"] },
})
  .use(profileGuard)
  // --- Account ---------------------------------------------------------------
  .get("/account", ({ profileId }) => account.accountStatus(profileId), {
    detail: {
      summary: "Get mailbox account status",
      description:
        "Returns the connection status of the profile's linked email account, including provider, email address, last sync time, and whether it can send.",
    },
  })
  .delete("/account", ({ profileId }) => account.disconnectAccount(profileId), {
    detail: {
      summary: "Disconnect mailbox account",
      description:
        "Removes the profile's connected email account and returns a confirmation that it was disconnected.",
    },
  })
  // --- Messages --------------------------------------------------------------
  .get("/messages", ({ profileId, query }) => svc.listMessages(profileId, query), {
    query: messagesQuery,
    detail: {
      summary: "List inbox messages",
      description:
        "Returns up to 200 of the profile's email messages, ordered newest first, filtered by the optional review status, classification, since date, domain hint, and verification domain query parameters.",
    },
  })
  .get("/messages/:id", ({ profileId, params }) => svc.getMessage(profileId, params.id), {
    params: idParam,
    detail: {
      summary: "Get inbox message",
      description:
        "Returns a single email message owned by the profile, including its matched application summary, or 404 if not found.",
    },
  })
  .patch(
    "/messages/:id",
    ({ profileId, params, body }) => svc.scanMessage(profileId, params.id, body),
    {
      params: idParam,
      body: scanMessageSchema,
      detail: {
        summary: "Scan and classify message",
        description:
          "Updates a message with classification, matching, verification, and review-status fields from a scan, publishes an inbox event, and returns the updated message.",
      },
    },
  )
  .post(
    "/messages/:id/approve",
    ({ profileId, params, body }) => svc.approveMessage(profileId, params.id, body),
    {
      params: idParam,
      body: approveSchema,
      detail: {
        summary: "Approve message and advance application",
        description:
          "Approves a classified message, transitions its matched application to the inferred target stage with a stage event, marks the message approved, and returns the message id, application id, and new stage.",
      },
    },
  )
  .post("/messages/:id/deny", ({ profileId, params }) => svc.denyMessage(profileId, params.id), {
    params: idParam,
    detail: {
      summary: "Deny message",
      description:
        "Marks the message's review status as denied, publishes an inbox event, and returns the message id with its denied status.",
    },
  })
  // --- Send / Sync -----------------------------------------------------------
  .post("/send", ({ user, profileId, body }) => account.send(user.id, profileId, body), {
    body: sendEmailSchema,
    detail: {
      summary: "Send outbound email",
      description:
        "Sends an email from the profile's connected mailbox (refreshing the token first), and returns the provider send result or errors when no account is connected or the mailbox lacks send access.",
    },
  })
  .post("/sync", ({ user, profileId }) => sync.syncInbox(user.id, profileId), {
    detail: {
      summary: "Sync inbox messages",
      description:
        "Fetches new messages from the connected mailbox, persists them, links any outreach replies, emits inbox sync events, and returns the fetched and newly inserted counts.",
    },
  })
  // --- Events SSE (now auth-scoped) ------------------------------------------
  .get("/events", () => sse(subscribe(inboxChannel, undefined)), {
    detail: {
      summary: "Stream inbox events",
      description:
        "Opens a Server-Sent Events stream that emits inbox events (such as sync progress and message scan/review updates) as a raw streaming response.",
    },
  })
  // --- OAuth -----------------------------------------------------------------
  .get(
    "/oauth/start",
    ({ query, cookie, redirect }) => {
      const providerName = query.provider ?? "gmail";
      const { authorizeUrl, state } = account.buildAuthorizeUrl(providerName);

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
      if (query.error) {
        throw new HttpError(ErrorCodes.UNPROCESSABLE, `OAuth error: ${query.error}`, 400);
      }
      if (!query.code || !query.state) {
        throw badRequest("Missing code or state");
      }

      const expectedState = cookie.email_oauth_state?.value;
      const providerName =
        (typeof cookie.email_oauth_provider?.value === "string"
          ? cookie.email_oauth_provider.value
          : undefined) ?? "gmail";
      if (!expectedState || expectedState !== query.state) {
        throw badRequest("OAuth state mismatch");
      }

      await account.completeEmailOAuth({
        providerName,
        code: query.code,
        userId: user.id,
        profileId,
      });

      cookie.email_oauth_state!.set({ value: "", path: OAUTH_COOKIE_PATH, maxAge: 0 });
      cookie.email_oauth_provider!.set({ value: "", path: OAUTH_COOKIE_PATH, maxAge: 0 });

      return redirect(`${env.APP_URL}/inbox`);
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
