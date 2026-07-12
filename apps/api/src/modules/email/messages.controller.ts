import { approveSchema, scanMessageSchema } from "@jobpilot/contracts/email";
import { idParam } from "@jobpilot/contracts/shared";
import { Elysia } from "elysia";
import { container } from "@/common/di";
import { profileGuard } from "@/common/middleware";
import { sseStream } from "@/common/sse";
import { inboxChannel } from "@/common/sse/channels/inbox";
import {
  emailMessageListSchema,
  emailMessageSchema,
  messageApprovedSchema,
  messageDeniedSchema,
  messagesQuery,
  syncResultSchema,
} from "./email.schema";
import { EmailService } from "./email.service";
import { EmailSyncService } from "./sync/sync.service";

const svc = container.resolve(EmailService);
const sync = container.resolve(EmailSyncService);

/** Inbox messages (list/get/scan/approve/deny), inbound sync, and the events stream. */
export const emailMessagesController = new Elysia({
  detail: { tags: ["Email"] },
})
  .use(profileGuard)
  .get("/messages", ({ profileId, query }) => svc.listMessages(profileId, query), {
    query: messagesQuery,
    response: emailMessageListSchema,
    detail: {
      summary: "List inbox messages",
      description:
        "Returns up to 200 of the profile's email messages, ordered newest first, filtered by the optional review status, classification, since date, domain hint, and verification domain query parameters.",
    },
  })
  .get("/messages/:id", ({ profileId, params }) => svc.getMessage(profileId, params.id), {
    params: idParam,
    response: emailMessageSchema,
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
      response: emailMessageSchema,
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
      response: messageApprovedSchema,
      detail: {
        summary: "Approve message and advance application",
        description:
          "Approves a classified message, transitions its matched application to the inferred target stage with a stage event, marks the message approved, and returns the message id, application id, and new stage.",
      },
    },
  )
  .post("/messages/:id/deny", ({ profileId, params }) => svc.denyMessage(profileId, params.id), {
    params: idParam,
    response: messageDeniedSchema,
    detail: {
      summary: "Deny message",
      description:
        "Marks the message's review status as denied, publishes an inbox event, and returns the message id with its denied status.",
    },
  })
  .post("/sync", ({ user, profileId }) => sync.syncInbox(user.id, profileId), {
    response: syncResultSchema,
    detail: {
      summary: "Sync inbox messages",
      description:
        "Fetches new messages from the connected mailbox, persists them, links any outreach replies, emits inbox sync events, and returns the fetched and newly inserted counts.",
    },
  })
  .get("/events", ({ headers, profileId }) => sseStream(inboxChannel, { profileId }, headers), {
    detail: {
      summary: "Stream inbox events",
      description:
        "Opens a Server-Sent Events stream that emits the signed-in profile's inbox events (such as sync progress and message scan/review updates) as a raw streaming response.",
    },
  });
