import {
  pushSubscriptionInputSchema,
  pushSubscriptionListSchema,
  pushSubscriptionSchema,
  pushUnsubscribeSchema,
  vapidKeySchema,
} from "@jobpilot/contracts/push";
import { Elysia } from "elysia";
import { container } from "@/common/di/container";
import { notFound } from "@/common/errors";
import { authGuard } from "@/common/middleware";
import { PushService } from "@/common/push/push.service";
import { RATE_LIMITS, rateLimit } from "@/common/rate-limit";
import { deletedResponseSchema } from "@/types/response";

const push = container.resolve(PushService);
const limitMutation = rateLimit(RATE_LIMITS.pilotMutation);

export const pushController = new Elysia({ prefix: "/push", detail: { tags: ["Push"] } })
  .use(authGuard)
  .get("/vapid-key", () => ({ publicKey: push.publicKey }), {
    response: vapidKeySchema,
    detail: {
      summary: "Get the VAPID public key",
      description:
        "The application-server key the browser subscribes with, or null when push is unconfigured.",
    },
  })
  .post("/subscriptions", ({ user, body }) => push.subscribe(user.id, body), {
    body: pushSubscriptionInputSchema,
    beforeHandle: limitMutation,
    response: pushSubscriptionSchema,
    detail: {
      summary: "Register a push subscription",
      description:
        "Upserts the browser's push subscription by endpoint, reassigning it to the caller.",
    },
  })
  .delete(
    "/subscriptions",
    async ({ user, body }) => {
      const deleted = await push.unsubscribe(user.id, body.endpoint);
      if (!deleted) {
        throw notFound("Subscription not found");
      }
      return { deleted };
    },
    {
      body: pushUnsubscribeSchema,
      beforeHandle: limitMutation,
      response: deletedResponseSchema,
      detail: {
        summary: "Remove a push subscription",
        description: "Deletes the caller's subscription for the given endpoint.",
      },
    },
  )
  .get("/subscriptions", ({ user }) => push.list(user.id), {
    response: pushSubscriptionListSchema,
    detail: {
      summary: "List push subscriptions",
      description: "The caller's registered push devices, newest first.",
    },
  });
