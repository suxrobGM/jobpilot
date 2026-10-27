import {
  jobAlertsStatusSchema,
  pilotJobAlertsSchema,
  runJobAlertsResultSchema,
} from "@jobpilot/contracts/pilot";
import { Elysia } from "elysia";
import { container } from "@/common/di/container";
import { authGuard } from "@/common/middleware";
import { RATE_LIMITS, rateLimit } from "@/common/rate-limit";
import { JobAlertsService } from "./job-alerts.service";
import { jobAlertsSeenBodySchema, jobAlertsSeenSchema } from "./pilot.schema";

const jobAlerts = container.get(JobAlertsService);
const limitMutation = rateLimit(RATE_LIMITS.pilotMutation);

export const pilotJobAlertsController = new Elysia({
  prefix: "/pilot",
  detail: { tags: ["Pilot"] },
})
  .use(authGuard)
  .get("/job-alerts", ({ user }) => jobAlerts.getStatus(user.id), {
    response: jobAlertsStatusSchema,
    detail: {
      summary: "Get the job-alert import status",
      description:
        "Returns the import schedule, how many unimported job-alert emails are waiting, the next scheduled run, any pending Run now request, and the most recent run with the campaign it opened.",
    },
  })
  .put("/job-alerts", ({ user, body }) => jobAlerts.updateSettings(user.id, body), {
    body: pilotJobAlertsSchema,
    beforeHandle: limitMutation,
    response: jobAlertsStatusSchema,
    detail: {
      summary: "Update the job-alert import schedule",
      description:
        "Replaces only the import block of the pilot instructions (on/off, run hours, time zone, extra sender domains), wakes the pilot, and returns the refreshed status.",
    },
  })
  .post("/job-alerts/run", ({ user }) => jobAlerts.runNow(user.id), {
    beforeHandle: limitMutation,
    response: runJobAlertsResultSchema,
    detail: {
      summary: "Run the job-alert import now",
      description:
        "Syncs the mailbox if it is stale, then queues an off-schedule import for the next pilot cycle and wakes the pilot. Nothing is queued when no unimported alert emails are waiting (`queued: false`); the request lapses after an hour if the pilot never gets to it.",
    },
  })
  .post("/job-alerts/seen", ({ user, body }) => jobAlerts.seenUrls(user.id, body.urls), {
    body: jobAlertsSeenBodySchema,
    response: jobAlertsSeenSchema,
    detail: {
      summary: "Find job-alert postings already imported",
      description:
        "Returns the given URLs, as sent, whose normalized form is already a job in one of the user's campaigns from the last 7 days. The import skips those instead of paging every recent campaign. Read-only.",
    },
  });
