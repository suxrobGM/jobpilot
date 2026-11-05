import { pilotThreadPageSchema, pilotThreadQuerySchema } from "@jobpilot/contracts/pilot";
import { Elysia } from "elysia";
import { container } from "@/common/di/container";
import { authGuard } from "@/common/middleware";
import { RATE_LIMITS, rateLimit } from "@/common/rate-limit";
import { PilotThreadService } from "./thread.service";

const thread = container.get(PilotThreadService);
const limitThread = rateLimit(RATE_LIMITS.pilotTasks);

export const pilotThreadController = new Elysia({ prefix: "/pilot", detail: { tags: ["Pilot"] } })
  .use(authGuard)
  .get("/thread", ({ user, query }) => thread.getThread(user.id, query.cursor, query.limit), {
    query: pilotThreadQuerySchema,
    beforeHandle: limitThread,
    response: pilotThreadPageSchema,
    detail: {
      summary: "Read the pilot thread",
      description:
        "Cursor-paged, newest first: runs folded into work blocks, plus questions, drafts, digests and notes from the same span.",
    },
  });
