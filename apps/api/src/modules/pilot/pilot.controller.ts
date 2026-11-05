import {
  pilotInstructionsImpactSchema,
  pilotStateSchema,
  recordIdleCycleSchema,
  updatePilotInstructionsSchema,
} from "@jobpilot/contracts/pilot";
import { pilotChannel } from "@jobpilot/contracts/sse";
import { Elysia } from "elysia";
import { container } from "@/common/di/container";
import { authGuard } from "@/common/middleware";
import { RATE_LIMITS, rateLimit } from "@/common/rate-limit";
import { sseStream } from "@/common/sse";
import {
  pilotActivityResponseSchema,
  pilotCostSchema,
  pilotTodayOutcomesSchema,
} from "./pilot.schema";
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
  .get("/instructions/impact", ({ user }) => pilot.instructionsImpact(user.id), {
    response: pilotInstructionsImpactSchema,
    detail: {
      summary: "Preview what an instructions edit leaves running",
      description:
        "Lists the searches, pilot campaigns and approved backlog an instructions edit would leave running, so the caller can choose what to retire.",
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
  .delete("/runs", ({ user }) => pilot.reset(user.id), {
    beforeHandle: limitMutation,
    response: pilotStateSchema,
    detail: {
      summary: "Reset the pilot's run history",
      description:
        "Deletes the journal, zeroes the cycle count and drops the cached task list. Instructions, searches and the running flag stay.",
    },
  })
  .post("/idle-checks", ({ user, body }) => pilot.recordIdleCycle(user.id, body), {
    body: recordIdleCycleSchema,
    beforeHandle: limitTaskList,
    response: pilotStateSchema,
    detail: {
      summary: "Record an idle check",
      description:
        "The host found nothing to run: advances the cycle count and next wake without a journal entry.",
    },
  })
  .get("/stats/today", ({ user }) => pilot.getTodayOutcomes(user.id), {
    beforeHandle: limitTaskList,
    response: pilotTodayOutcomesSchema,
    detail: {
      summary: "Today's non-applied outcomes",
      description:
        "Today's skipped and failed job counts, with skip reasons bucketed by frequency.",
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
