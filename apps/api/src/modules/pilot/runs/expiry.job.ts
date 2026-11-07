import { cron } from "@elysiajs/cron";
import { container } from "@/common/di/container";
import { logger } from "@/common/logger";
import { env } from "@/env";
import { PilotMaintenanceService } from "../tasks/maintenance.service";

/** Every 10 minutes: task-list refreshes only expire a running pilot's runs, not a stopped one's. */
export const expiryJob = cron({
  name: "pilot-run-expiry",
  pattern: "*/10 * * * *",
  run() {
    // Production only, like the retention job: a dev host shares the remote database.
    if (env.NODE_ENV !== "production") {
      return;
    }

    container
      .get(PilotMaintenanceService)
      .expireAbandonedRuns(new Date())
      .then((users) => {
        if (users > 0) {
          logger.info({ users }, "Expired abandoned pilot runs");
        }
      })
      .catch((err) => logger.error({ err }, "Pilot run expiry failed"));
  },
});
