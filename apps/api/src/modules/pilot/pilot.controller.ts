import {
  pilotStateSchema,
  recordCycleSchema,
  setAutopilotSchema,
  updatePilotSettingsSchema,
} from "@jobpilot/contracts/pilot";
import { pilotChannel } from "@jobpilot/contracts/sse";
import { Elysia, sse } from "elysia";
import { container } from "@/common/di/container";
import { authGuard } from "@/common/middleware";
import { RATE_LIMITS, rateLimit } from "@/common/rate-limit";
import { subscribe } from "@/common/sse";
import { AgentPresence } from "./agent-presence";
import { pilotActivityResponseSchema, pilotCostSchema } from "./pilot.schema";
import { PilotService } from "./pilot.service";

const pilot = container.get(PilotService);
const presence = container.get(AgentPresence);

const limitTaskList = rateLimit(RATE_LIMITS.pilotTasks);
const limitMutation = rateLimit(RATE_LIMITS.pilotMutation);

export const pilotController = new Elysia({
  prefix: "/pilot",
  detail: { tags: ["Pilot"] },
})
  .use(authGuard)
  .get("/", ({ user }) => pilot.getState(user.id), {
    response: pilotStateSchema,
    detail: {
      summary: "Get pilot state",
      description: "Returns the user's Pilot state, creating it with defaults on first read.",
    },
  })
  .patch("/settings", ({ user, body }) => pilot.updateSettings(user.id, body), {
    body: updatePilotSettingsSchema,
    beforeHandle: limitMutation,
    response: pilotStateSchema,
    detail: {
      summary: "Update pilot settings",
      description:
        "Patches boards, check interval and networking. Rules change through /pilot/changes; job alerts through their own route.",
    },
  })
  .put("/autopilot", ({ user, body }) => pilot.setAutopilot(user.id, body.enabled), {
    body: setAutopilotSchema,
    beforeHandle: limitMutation,
    response: pilotStateSchema,
    detail: {
      summary: "Turn autopilot on or off",
      description:
        "With autopilot off, the pilot runs only what the user asks for: requests, chat and answered questions.",
    },
  })
  .post("/cycles", ({ user, body }) => pilot.recordCycle(user.id, body), {
    body: recordCycleSchema,
    beforeHandle: limitTaskList,
    response: pilotStateSchema,
    detail: {
      summary: "Record a cycle",
      description:
        "The host finished one loop pass, with or without a run: advances the cycle count and plans the next wake. A message is posted to the user as the pilot.",
    },
  })
  .get("/stats/cost", ({ user }) => pilot.getCost(user.id), {
    beforeHandle: limitTaskList,
    response: pilotCostSchema,
    detail: {
      summary: "Where the last week of tokens went",
      description:
        "Per task type over the last 7 days: runs, median new tokens (input, output, cache write), the token breakdown, failed and unfinished runs, most new tokens first.",
    },
  })
  .get("/activity", ({ user }) => pilot.getActivity(user.id), {
    beforeHandle: limitTaskList,
    response: pilotActivityResponseSchema,
    detail: {
      summary: "Pilot liveness activity",
      description:
        "Newest agent activity and the active-run count, so the host can tell a long run from a stuck one.",
    },
  })
  .get(
    "/events",
    ({ user, headers }) =>
      sse(
        presence.track(
          user,
          subscribe(pilotChannel, { userId: user.id }, headers["last-event-id"]),
        ),
      ),
    {
      detail: {
        summary: "Stream pilot events",
        description:
          "Server-Sent Events for messages, questions, runs and state changes. The host's stream also marks the agent connected.",
      },
    },
  );
