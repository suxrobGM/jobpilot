import {
  pushSubscriptionInputSchema,
  pushSubscriptionListSchema,
  pushSubscriptionSchema,
  pushUnsubscribeSchema,
  vapidKeySchema,
} from "@jobpilot/contracts/pilot";
import { Elysia } from "elysia";
import { container } from "@/common/di";
import { notFound } from "@/common/errors";
import { profileGuard } from "@/common/middleware";
import { RATE_LIMITS, rateLimit } from "@/common/rate-limit";
import { deletedResponseSchema } from "@/types/response";
import { PushService } from "./push.service";

const push = container.resolve(PushService);
const limitMutation = rateLimit(RATE_LIMITS.pilotMutation);

export const pushController = new Elysia({ name: "pilot-push", detail: { tags: ["Pilot"] } })
  .use(profileGuard)
  .get("/push/vapid-key", () => ({ publicKey: push.publicKey }), {
    response: vapidKeySchema,
    detail: {
      summary: "Get the VAPID public key",
      description:
        "The application-server key the browser subscribes with, or null when push is unconfigured.",
    },
  })
  .post("/push/subscriptions", ({ profileId, body }) => push.subscribe(profileId, body), {
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
    "/push/subscriptions",
    async ({ profileId, body }) => {
      const deleted = await push.unsubscribe(profileId, body.endpoint);
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
  .get("/push/subscriptions", ({ profileId }) => push.list(profileId), {
    response: pushSubscriptionListSchema,
    detail: {
      summary: "List push subscriptions",
      description: "The caller's registered push devices, newest first.",
    },
  });
