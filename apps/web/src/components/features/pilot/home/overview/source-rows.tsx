"use client";

import type { ReactElement, ReactNode } from "react";
import type { JobAlertsStatus } from "@jobpilot/contracts/pilot";
import { PlayArrow } from "@mui/icons-material";
import { useQuery } from "@tanstack/react-query";
import { pilotQueries } from "@/api/queries";
import type { ResearchStatusDto } from "@/api/types";
import { TooltipIconButton } from "@/components/ui/buttons";
import { formatHour, formatRelativeTime } from "@/utils/format";
import { pipelineHref } from "@/utils/routes";
import { useCreateRequest } from "../../requests/use-create-request";
import { EdgeLinkButton, OverviewRow } from "./overview-section";

function isImporting(status: JobAlertsStatus): boolean {
  return status.lastRun !== null && status.lastRun.outcome === null;
}

function jobAlertsDetail(status: JobAlertsStatus): string {
  if (!status.mailboxConnected) {
    return "Not connected";
  }
  if (isImporting(status)) {
    return "Importing now";
  }
  const { settings } = status;
  const schedule = settings.enabled ? settings.runHours.map(formatHour).join(", ") : "Off";
  const waiting = status.pendingEmails > 0 ? ` · ${status.pendingEmails} waiting` : "";
  return `${schedule}${waiting}`;
}

/** Why a run can't be asked for, or null when it can. */
function runDisabledReason(status: JobAlertsStatus): string | null {
  if (isImporting(status)) {
    return "An import is running.";
  }
  if (status.pendingEmails === 0) {
    return "No new job alert emails to import.";
  }
  return null;
}

interface JobAlertsActionProps {
  status: JobAlertsStatus;
}

/** Points at what's missing before offering a run. */
function JobAlertsAction(props: JobAlertsActionProps): ReactElement {
  const { status } = props;
  const request = useCreateRequest();
  if (!status.mailboxConnected) {
    return <EdgeLinkButton label="Connect" href="/settings/email" />;
  }
  if (!status.settings.enabled && status.pendingEmails === 0) {
    return <EdgeLinkButton label="Set up" href="/settings/pilot" />;
  }
  const disabledReason = runDisabledReason(status);
  return (
    <TooltipIconButton
      title={disabledReason ?? "Import now"}
      size="small"
      disabled={disabledReason !== null || request.isPending}
      onClick={() => request.mutate({ taskType: "inbox.jobAlerts", payload: {} })}
      sx={{ mr: -0.5 }}
    >
      <PlayArrow fontSize="sm" />
    </TooltipIconButton>
  );
}

export function JobAlertsSource(): ReactNode {
  const status = useQuery(pilotQueries.jobAlerts()).data;
  if (!status) {
    return null;
  }
  return (
    <OverviewRow
      label="Alert emails"
      detail={jobAlertsDetail(status)}
      end={<JobAlertsAction status={status} />}
    />
  );
}

const WEB_SEARCH_HINT =
  "Searches the web beyond your boards: company career pages, university and lab portals. Ask the pilot to find more jobs to run one now.";

function researchDetail(status: ResearchStatusDto): string {
  const { lastRun } = status;
  if (!lastRun) {
    return "Weekly";
  }
  if (lastRun.outcome === null) {
    return "Searching now";
  }
  return `${formatRelativeTime(lastRun.startedAt)} ago`;
}

/** When the web search last ran, and where its jobs landed. */
export function ResearchSource(): ReactNode {
  const status = useQuery(pilotQueries.research()).data;
  if (!status) {
    return null;
  }
  return (
    <OverviewRow
      label="Web search"
      detail={researchDetail(status)}
      hint={WEB_SEARCH_HINT}
      end={status.feedId && <EdgeLinkButton label="View" href={pipelineHref(status.feedId)} />}
    />
  );
}
