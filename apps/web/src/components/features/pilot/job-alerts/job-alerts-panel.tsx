"use client";

import { type ReactElement, useState } from "react";
import type { JobAlertsStatus, PILOT_RUN_OUTCOMES } from "@jobpilot/contracts/pilot";
import { Schedule } from "@mui/icons-material";
import { Alert, Button, Chip, Stack, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { pilotQueries } from "@/api/queries";
import { LinkButton } from "@/components/ui/buttons";
import { QuerySection } from "@/components/ui/feedback";
import { SectionCard } from "@/components/ui/layout";
import { formatRelativeTime, formatTimeUntil, plural } from "@/utils/format";
import { campaignHref } from "@/utils/routes";
import { formatHour } from "../run-status";
import { RunJobAlertsButton, runDisabledReason } from "./run-job-alerts-button";
import { ScheduleDialog } from "./schedule-dialog";

// Run events arrive over SSE (pilot-live.tsx); the poll only catches newly synced mail.
const POLL_INTERVAL_MS = 120_000;

const OUTCOME_LABELS: Record<(typeof PILOT_RUN_OUTCOMES)[number], string> = {
  done: "finished",
  failed: "failed",
  cancelled: "was cancelled",
  expired: "timed out",
};

function scheduleSummary(status: JobAlertsStatus): string {
  const { settings } = status;
  if (!settings.enabled) {
    return "Not scheduled - runs only when you click Run now.";
  }
  const times = settings.runHours.map(formatHour).join(", ");
  const next = status.nextRunAt ? ` · next in ${formatTimeUntil(status.nextRunAt)}` : "";
  return `Runs daily at ${times} ${settings.timeZone}${next}`;
}

interface LastRunProps {
  lastRun: JobAlertsStatus["lastRun"];
}

function LastRun(props: LastRunProps): ReactElement {
  const { lastRun } = props;
  if (!lastRun) {
    return <Typography variant="captionMuted">No import has run yet.</Typography>;
  }
  const finished = lastRun.outcome ? OUTCOME_LABELS[lastRun.outcome] : null;
  return (
    <Stack direction="row" spacing={1} useFlexGap sx={{ alignItems: "center", flexWrap: "wrap" }}>
      <Typography variant="captionMuted">
        {finished
          ? `Last run ${finished} ${formatRelativeTime(lastRun.finishedAt ?? lastRun.startedAt)} ago`
          : `Importing now - started ${formatRelativeTime(lastRun.startedAt)} ago`}
      </Typography>
      {lastRun.campaign && (
        <LinkButton size="small" href={campaignHref(lastRun.campaign.id)}>
          {lastRun.campaign.query}
        </LinkButton>
      )}
    </Stack>
  );
}

export function JobAlertsPanel(): ReactElement {
  const [editing, setEditing] = useState(false);
  const query = useQuery({ ...pilotQueries.jobAlerts(), refetchInterval: POLL_INTERVAL_MS });
  const status = query.data;
  const disabledReason = status ? runDisabledReason(status) : null;

  return (
    <SectionCard
      title="Job alert emails"
      description="Pulls every posting out of alert emails from LinkedIn, Ladders, FlexJobs and more, ranks them against your resume, and opens a campaign. Matches at or above your min score get applied to."
    >
      <QuerySection
        query={query}
        errorTitle="Couldn't load the job alert schedule."
        isEmpty={false}
        empty={null}
      >
        {status && (
          <Stack spacing={1.5}>
            <Stack
              direction="row"
              spacing={1}
              useFlexGap
              sx={{ alignItems: "center", flexWrap: "wrap" }}
            >
              <Chip
                color={status.settings.enabled ? "primary" : "default"}
                label={status.settings.enabled ? "Scheduled" : "Off"}
              />
              <Typography variant="body2">{scheduleSummary(status)}</Typography>
            </Stack>
            <Typography variant="body2">
              {status.pendingEmails === 0
                ? "No new alert emails waiting."
                : `${plural(status.pendingEmails, "alert email")} waiting to be imported.`}
            </Typography>
            {status.requestedAt && (
              <Typography variant="captionMuted">
                Run queued {formatRelativeTime(status.requestedAt)} ago - it starts on the pilot's
                next cycle.
              </Typography>
            )}
            <LastRun lastRun={status.lastRun} />
            {disabledReason && (
              <Alert severity="info" variant="outlined">
                {disabledReason}
              </Alert>
            )}
            <Stack direction="row" spacing={1} sx={{ justifyContent: "flex-end" }}>
              <Button size="small" startIcon={<Schedule />} onClick={() => setEditing(true)}>
                Schedule
              </Button>
              <RunJobAlertsButton status={status} />
            </Stack>
          </Stack>
        )}
      </QuerySection>
      {status && (
        <ScheduleDialog open={editing} status={status} onClose={() => setEditing(false)} />
      )}
    </SectionCard>
  );
}
