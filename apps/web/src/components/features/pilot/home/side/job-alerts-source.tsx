"use client";

import type { ReactNode } from "react";
import type { JobAlertsStatus } from "@jobpilot/contracts/pilot";
import { useQuery } from "@tanstack/react-query";
import { pilotQueries } from "@/api/queries";
import { formatTimeUntil, plural } from "@/utils/format";
import { formatHour, isRunning } from "../../run-status";
import { RunJobAlertsButton } from "./run-job-alerts-button";
import { SourceRow } from "./source-row";

function jobAlertsDetail(status: JobAlertsStatus): string {
  if (isRunning(status)) {
    return "Importing now";
  }
  const waiting =
    status.pendingEmails > 0 ? ` · ${plural(status.pendingEmails, "email")} waiting` : "";
  const { settings } = status;
  if (!settings.enabled) {
    return `Not scheduled${waiting}`;
  }
  const times = settings.runHours.map(formatHour).join(", ");
  const next = status.nextRunAt ? `, next in ${formatTimeUntil(status.nextRunAt)}` : "";
  return `Daily at ${times}${next}${waiting}`;
}

export function JobAlertsSource(): ReactNode {
  const status = useQuery(pilotQueries.jobAlerts()).data;
  if (!status) {
    return null;
  }
  return (
    <SourceRow
      label="Job alert emails"
      detail={jobAlertsDetail(status)}
      action={<RunJobAlertsButton status={status} />}
    />
  );
}
