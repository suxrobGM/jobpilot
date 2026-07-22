import {
  pilotStateSchema,
  setPilotEnabledSchema,
  updatePilotInstructionsSchema,
} from "@jobpilot/contracts/pilot";
import { pilotChannel } from "@jobpilot/contracts/sse";
import { Elysia } from "elysia";
import { container } from "@/common/di";
import { authGuard } from "@/common/middleware";
import { RATE_LIMITS, rateLimit } from "@/common/rate-limit";
import { sseStream } from "@/common/sse";
import { pilotActivityResponseSchema } from "./pilot.schema";
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
  .put("/instructions", ({ user, body }) => pilot.updateInstructions(user.id, body), {
    body: updatePilotInstructionsSchema,
    beforeHandle: limitMutation,
    response: pilotStateSchema,
    detail: {
      summary: "Update instructions",
      description: "Replaces the Pilot's goals and operating config and returns the updated state.",
    },
  })
  .post("/enabled", ({ user, body }) => pilot.setEnabled(user.id, body), {
    body: setPilotEnabledSchema,
    beforeHandle: limitMutation,
    response: pilotStateSchema,
    detail: {
      summary: "Enable or disable the pilot",
      description: "Toggles the autonomous loop on or off and returns the updated state.",
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
