import { approveSchema, scanMessageSchema } from "@jobpilot/contracts/email";
import { idParam } from "@jobpilot/contracts/shared";
import { inboxChannel } from "@jobpilot/contracts/sse";
import { Elysia } from "elysia";
import { container } from "@/common/di/container";
import { authGuard } from "@/common/middleware";
import { sseStream } from "@/common/sse";
import {
  emailMessageListSchema,
  emailMessageSchema,
  messageApprovedSchema,
  messageCountSchema,
  messageDeniedSchema,
  messageFilters,
  messagesQuery,
  syncResultSchema,
} from "./email.schema";
import { EmailService } from "./email.service";
import { EmailSyncService } from "./sync/sync.service";

const svc = container.resolve(EmailService);
const sync = container.resolve(EmailSyncService);

/** Inbox messages (list/get/scan/approve/deny), inbound sync, and the events stream. */
export const emailMessagesController = new Elysia({
  prefix: "/email",
  detail: { tags: ["Email"] },
})
  .use(authGuard)
  .get("/messages", ({ user, query }) => svc.listMessages(user.id, query), {
    query: messagesQuery,
    response: emailMessageListSchema,
    detail: {
      summary: "List inbox messages",
      description:
        "Returns one page of the profile's email messages as `{ items, pagination }`, ordered newest first, filtered by the optional review status, classification, since date, domain hint, and verification domain query parameters.",
    },
  })
  .get("/messages/count", ({ user, query }) => svc.countMessages(user.id, query), {
    query: messageFilters,
    response: messageCountSchema,
    detail: {
      summary: "Count inbox messages",
      description:
        "Returns `{ count }` for the same filters the list route accepts. For callers that render a number and would otherwise page a full message to read the pagination total.",
    },
  })
  .get("/messages/:id", ({ user, params }) => svc.getMessage(user.id, params.id), {
    params: idParam,
    response: emailMessageSchema,
    detail: {
      summary: "Get inbox message",
      description:
        "Returns a single email message owned by the profile, including its matched application summary, or 404 if not found.",
    },
  })
  .patch("/messages/:id", ({ user, params, body }) => svc.scanMessage(user.id, params.id, body), {
    params: idParam,
    body: scanMessageSchema,
    response: emailMessageSchema,
    detail: {
      summary: "Scan and classify message",
      description:
        "Updates a message with classification, matching, verification, and review-status fields from a scan, publishes an inbox event, and returns the updated message.",
    },
  })
  .post(
    "/messages/:id/approve",
    ({ user, params, body }) => svc.approveMessage(user.id, params.id, body),
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
  .post("/messages/:id/deny", ({ user, params }) => svc.denyMessage(user.id, params.id), {
    params: idParam,
    response: messageDeniedSchema,
    detail: {
      summary: "Deny message",
      description:
        "Marks the message's review status as denied, publishes an inbox event, and returns the message id with its denied status.",
    },
  })
  .post("/sync", ({ user }) => sync.syncInbox(user.id), {
    response: syncResultSchema,
    detail: {
      summary: "Sync inbox messages",
      description:
        "Fetches new messages from the connected mailbox, persists them, links any networking replies, emits inbox sync events, and returns the fetched and newly inserted counts.",
    },
  })
  .get("/events", ({ headers, user }) => sseStream(inboxChannel, { userId: user.id }, headers), {
    detail: {
      summary: "Stream inbox events",
      description:
        "Opens a Server-Sent Events stream that emits the signed-in profile's inbox events (such as sync progress and message scan/review updates) as a raw streaming response.",
    },
  });
