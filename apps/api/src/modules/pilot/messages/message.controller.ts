import {
  createPilotMessageSchema,
  pilotMessageListSchema,
  pilotMessageSchema,
  pilotMessagesQuerySchema,
} from "@jobpilot/contracts/pilot";
import { Elysia } from "elysia";
import { container } from "@/common/di/container";
import { authGuard } from "@/common/middleware";
import { RATE_LIMITS, rateLimit } from "@/common/rate-limit";
import { MessageService } from "./message.service";

const messages = container.get(MessageService);
const limitMutation = rateLimit(RATE_LIMITS.pilotMutation);

export const pilotMessagesController = new Elysia({
  prefix: "/pilot/messages",
  detail: { tags: ["Pilot"] },
})
  .use(authGuard)
  .get("/", ({ user, query }) => messages.listRecent(user.id, query.limit), {
    query: pilotMessagesQuerySchema,
    response: pilotMessageListSchema,
    detail: {
      summary: "Read the conversation",
      description: "The newest messages between the user and the pilot, oldest first.",
    },
  })
  .post("/", ({ user, body }) => messages.create(user.id, body.body), {
    body: createPilotMessageSchema,
    beforeHandle: limitMutation,
    response: pilotMessageSchema,
    detail: {
      summary: "Message the pilot",
      description:
        "Stores the user's message. The pilot answers it in a chat.reply run, ahead of everything else.",
    },
  });
