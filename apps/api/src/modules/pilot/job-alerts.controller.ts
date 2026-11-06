import { jobAlertsStatusSchema, pilotJobAlertsSchema } from "@jobpilot/contracts/pilot";
import { Elysia } from "elysia";
import { container } from "@/common/di/container";
import { authGuard } from "@/common/middleware";
import { RATE_LIMITS, rateLimit } from "@/common/rate-limit";
import { JobAlertsService } from "./job-alerts.service";

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
        "Returns the import schedule, how many unimported job-alert emails are waiting, the next scheduled run, and the most recent run with the campaign it opened.",
    },
  })
  .put("/job-alerts", ({ user, body }) => jobAlerts.updateSettings(user.id, body), {
    body: pilotJobAlertsSchema,
    beforeHandle: limitMutation,
    response: jobAlertsStatusSchema,
    detail: {
      summary: "Update the job-alert import schedule",
      description:
        "Replaces only the import block of the pilot config (on/off, run hours, time zone, extra sender domains), wakes the pilot, and returns the refreshed status.",
    },
  });
