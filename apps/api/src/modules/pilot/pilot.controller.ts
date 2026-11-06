import {
  pilotStateSchema,
  recordCycleSchema,
  setAutopilotSchema,
  updatePilotSettingsSchema,
} from "@jobpilot/contracts/pilot";
import { pilotChannel } from "@jobpilot/contracts/sse";
import { Elysia } from "elysia";
import { container } from "@/common/di/container";
import { authGuard } from "@/common/middleware";
import { RATE_LIMITS, rateLimit } from "@/common/rate-limit";
import { sseStream } from "@/common/sse";
import { pilotActivityResponseSchema, pilotCostSchema } from "./pilot.schema";
import { PilotService } from "./pilot.service";

const pilot = container.get(PilotService);

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
        "Patches boards, check interval and networking. Goals and rules change through /pilot/changes; job alerts through their own route.",
    },
  })
  .put("/autopilot", ({ user, body }) => pilot.setAutopilot(user.id, body.enabled), {
    body: setAutopilotSchema,
    beforeHandle: limitMutation,
    response: pilotStateSchema,
    detail: {
      summary: "Turn autopilot on or off",
      description:
        "With autopilot off, the pilot runs only what the user asks for: requests, chat and answered questions. Turning it on rejects with 409 when the goals are empty.",
    },
  })
  .delete("/runs", ({ user }) => pilot.reset(user.id), {
    beforeHandle: limitMutation,
    response: pilotStateSchema,
    detail: {
      summary: "Reset the pilot's run history",
      description:
        "Deletes the journal, zeroes the cycle count and drops the cached task list. Instructions, searches and autopilot stay.",
    },
  })
  .post("/cycles", ({ user, body }) => pilot.recordCycle(user.id, body), {
    body: recordCycleSchema,
    beforeHandle: limitTaskList,
    response: pilotStateSchema,
    detail: {
      summary: "Record a cycle",
      description:
        "The host finished one loop pass, with or without a run: advances the cycle count and plans the next wake.",
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
  .get("/events", ({ user, headers }) => sseStream(pilotChannel, { userId: user.id }, headers), {
    detail: {
      summary: "Stream pilot events",
      description: "Server-Sent Events for journal appends, questions, runs and state changes.",
    },
  });
