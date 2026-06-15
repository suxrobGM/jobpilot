import { approveSchema, scanMessageSchema } from "@jobpilot/contracts/email";
import { sendEmailSchema } from "@jobpilot/contracts/outreach";
import { idParam } from "@jobpilot/contracts/shared";
import { Elysia } from "elysia";
import { z } from "zod/v4";
import { container } from "@/common/di";
import { badRequest, ErrorCodes, HttpError } from "@/common/errors";
import { profileGuard } from "@/common/middleware";
import { sseResponse, subscribe } from "@/common/sse";
import { inboxChannel } from "@/common/sse/channels/inbox";
import { env } from "@/env";
import { EmailService } from "./email.service";

const svc = container.resolve(EmailService);

const messagesQuery = z.object({
  reviewStatus: z.string().optional(),
  classification: z.string().optional(),
  since: z.string().optional(),
  domainHint: z.string().optional(),
  verificationDomain: z.string().optional(),
});

const startQuery = z.object({ provider: z.string().optional() });

const callbackQuery = z.object({
  code: z.string().optional(),
  state: z.string().optional(),
  error: z.string().optional(),
});

const OAUTH_COOKIE_PATH = "/api/email/oauth";

export const emailController = new Elysia({
  prefix: "/email",
  detail: { tags: ["Email"] },
})
  .use(profileGuard)
  // --- Account ---------------------------------------------------------------
  .get("/account", ({ profileId }) => svc.accountStatus(profileId))
  .delete("/account", ({ profileId }) => svc.disconnectAccount(profileId))
  // --- Messages --------------------------------------------------------------
  .get("/messages", ({ profileId, query }) => svc.listMessages(profileId, query), {
    query: messagesQuery,
  })
  .get("/messages/:id", ({ profileId, params }) => svc.getMessage(profileId, params.id), {
    params: idParam,
  })
  .patch(
    "/messages/:id",
    ({ profileId, params, body }) => svc.scanMessage(profileId, params.id, body),
    { params: idParam, body: scanMessageSchema },
  )
  .post(
    "/messages/:id/approve",
    ({ profileId, params, body }) => svc.approveMessage(profileId, params.id, body),
    { params: idParam, body: approveSchema },
  )
  .post("/messages/:id/deny", ({ profileId, params }) => svc.denyMessage(profileId, params.id), {
    params: idParam,
  })
  // --- Send / Sync -----------------------------------------------------------
  .post("/send", ({ profileId, body }) => svc.send(profileId, body), { body: sendEmailSchema })
  .post("/sync", ({ profileId }) => svc.syncInbox(profileId))
  // --- Events SSE (now auth-scoped) ------------------------------------------
  .get("/events", () => sseResponse(subscribe(inboxChannel, undefined)))
  // --- OAuth -----------------------------------------------------------------
  .get(
    "/oauth/start",
    ({ query, cookie, redirect }) => {
      const providerName = query.provider ?? "gmail";
      const { authorizeUrl, state } = svc.buildAuthorizeUrl(providerName);

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
    { query: startQuery },
  )
  .get(
    "/oauth/callback",
    async ({ profileId, query, cookie, redirect }) => {
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

      await svc.completeEmailOAuth({ providerName, code: query.code, profileId });

      cookie.email_oauth_state!.set({ value: "", path: OAUTH_COOKIE_PATH, maxAge: 0 });
      cookie.email_oauth_provider!.set({ value: "", path: OAUTH_COOKIE_PATH, maxAge: 0 });

      return redirect(`${env.APP_URL}/inbox`);
    },
    { query: callbackQuery },
  );
