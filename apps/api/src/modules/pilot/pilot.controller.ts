import {
  pilotInstructionsImpactSchema,
  pilotStateSchema,
  updatePilotInstructionsSchema,
} from "@jobpilot/contracts/pilot";
import { pilotChannel } from "@jobpilot/contracts/sse";
import { Elysia } from "elysia";
import { container } from "@/common/di";
import { authGuard } from "@/common/middleware";
import { RATE_LIMITS, rateLimit } from "@/common/rate-limit";
import { sseStream } from "@/common/sse";
import { pilotActivityResponseSchema, pilotTodayOutcomesSchema } from "./pilot.schema";
import { PilotService } from "./pilot.service";

const pilot = container.resolve(PilotService);

const limitAgenda = rateLimit(RATE_LIMITS.pilotAgenda);
const limitMutation = rateLimit(RATE_LIMITS.pilotMutation);

// Core pilot-state routes. Per-domain routes (searches, agenda, claims, journal, questions) live in
// sibling `/pilot` controllers, each mounted standalone in app.ts.
export const pilotController = new Elysia({
  prefix: "/pilot",
  detail: { tags: ["Pilot"] },
})
  .use(authGuard)
  .get("/", ({ user }) => pilot.getState(user.id), {
    response: pilotStateSchema,
    detail: {
      summary: "Get pilot state",
      description: "Returns the profile's Pilot state, creating it with defaults on first read.",
    },
  })
  .get("/instructions/impact", ({ user }) => pilot.instructionsImpact(user.id), {
    response: pilotInstructionsImpactSchema,
    detail: {
      summary: "Preview what an instructions edit leaves running",
      description:
        "Lists the searches, in-progress pilot campaigns and approved backlog that outlive an instructions edit, so the caller can decide what to retire alongside it.",
    },
  })
  .put("/instructions", ({ user, body }) => pilot.updateInstructions(user.id, body), {
    body: updatePilotInstructionsSchema,
    beforeHandle: limitMutation,
    response: pilotStateSchema,
    detail: {
      summary: "Update instructions",
      description: "Replaces the Pilot's goals and operating config and returns the updated state.",
    },
  })
  .post("/start", ({ user }) => pilot.start(user.id), {
    beforeHandle: limitMutation,
    response: pilotStateSchema,
    detail: {
      summary: "Start the pilot",
      description:
        "Starts the autonomous loop and returns the updated state. Rejects with 409 when the pilot's goals are empty.",
    },
  })
  .post("/stop", ({ user }) => pilot.stop(user.id), {
    beforeHandle: limitMutation,
    response: pilotStateSchema,
    detail: {
      summary: "Stop the pilot",
      description: "Stops the autonomous loop and returns the updated state.",
    },
  })
  .post("/reset", ({ user }) => pilot.reset(user.id), {
    beforeHandle: limitMutation,
    response: pilotStateSchema,
    detail: {
      summary: "Reset the pilot's run history",
      description:
        "Deletes every journal entry, sets the cycle counter back to 0, and drops the cached agenda. Instructions, searches and the running flag are untouched.",
    },
  })
  .get("/stats/today", ({ user }) => pilot.getTodayOutcomes(user.id), {
    beforeHandle: limitAgenda,
    response: pilotTodayOutcomesSchema,
    detail: {
      summary: "Today's non-applied outcomes",
      description:
        "How many of the profile's jobs were skipped or failed today, with the skip reasons bucketed by frequency. Applied counts come from the pilot state.",
    },
  })
  .get("/activity", ({ user }) => pilot.getActivity(user.id), {
    beforeHandle: limitAgenda,
    response: pilotActivityResponseSchema,
    detail: {
      summary: "Pilot liveness activity",
      description:
        "Newest server-side agent activity (claims, journal, campaign/job writes) plus the active-claim count, so the terminal orchestrator can tell a live long run from a genuinely stuck one.",
    },
  })
  .get("/events", ({ user, headers }) => sseStream(pilotChannel, { userId: user.id }, headers), {
    detail: {
      summary: "Stream pilot events",
      description:
        "Server-Sent Events for the profile's Pilot: journal appends, question lifecycle, and state changes.",
    },
  });
