"use client";

import type { ReactNode } from "react";
import type { JobAlertsStatus } from "@jobpilot/contracts/pilot";
import { useQuery } from "@tanstack/react-query";
import { pilotQueries } from "@/api/queries";
import { formatHour, isRunning } from "../../run-status";
import { EdgeLinkButton } from "./edge-link-button";
import { RunJobAlertsButton } from "./run-job-alerts-button";
import { SourceRow } from "./source-row";

function jobAlertsDetail(status: JobAlertsStatus): string {
  if (!status.mailboxConnected) {
    return "Not connected";
  }
  if (isRunning(status)) {
    return "Importing now";
  }
  const { settings } = status;
  const schedule = settings.enabled ? settings.runHours.map(formatHour).join(", ") : "Off";
  const waiting = status.pendingEmails > 0 ? ` · ${status.pendingEmails} waiting` : "";
  return `${schedule}${waiting}`;
}

interface JobAlertsActionProps {
  status: JobAlertsStatus;
}

/** Points at what's missing before offering a run. */
function JobAlertsAction(props: JobAlertsActionProps): ReactNode {
  const { status } = props;
  if (!status.mailboxConnected) {
    return <EdgeLinkButton label="Connect" href="/settings/email" />;
  }
  if (!status.settings.enabled && status.pendingEmails === 0) {
    return <EdgeLinkButton label="Set up" href="/settings/pilot" />;
  }
  return <RunJobAlertsButton status={status} />;
}

export function JobAlertsSource(): ReactNode {
  const status = useQuery(pilotQueries.jobAlerts()).data;
  if (!status) {
    return null;
  }
  return (
    <SourceRow
      label="Alert emails"
      detail={jobAlertsDetail(status)}
      action={<JobAlertsAction status={status} />}
    />
  );
}
