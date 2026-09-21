"use client";

import { type ReactElement, useState } from "react";
import type { JobAlertsStatus, PilotJobAlerts } from "@jobpilot/contracts/pilot";
import { Schedule } from "@mui/icons-material";
import { Alert, Button, Chip, Stack, Typography } from "@mui/material";
import type { Route } from "next";
import { api } from "@/api/client";
import { useApiMutation } from "@/api/hooks";
import { queryKeys } from "@/api/query-keys";
import { LinkButton } from "@/components/ui/buttons";
import { QuerySection } from "@/components/ui/data";
import { SectionCard } from "@/components/ui/layout";
import { formatRelativeTime, formatTimeUntil, plural } from "@/utils/format";
import { RunJobAlertsButton } from "./run-job-alerts-button";
import { ScheduleDialog } from "./schedule-dialog";
import { runBlocker, useJobAlerts } from "./use-job-alerts";

const OUTCOME_LABELS: Record<string, string> = {
  done: "finished",
  failed: "failed",
  abandoned: "was abandoned",
  expired: "timed out",
};

function scheduleSummary(status: JobAlertsStatus): string {
  const { settings } = status;
  if (!settings.enabled) return "Not scheduled - runs only when you click Run now.";
  const times = settings.runHours.map((hour) => `${String(hour).padStart(2, "0")}:00`).join(", ");
  const next = status.nextRunAt ? ` · next in ${formatTimeUntil(status.nextRunAt)}` : "";
  return `Runs daily at ${times} ${settings.timeZone}${next}`;
}

function LastRun(props: { status: JobAlertsStatus }): ReactElement | null {
  const { lastRun } = props.status;
  if (!lastRun) {
    return <Typography variant="captionMuted">No harvest has run yet.</Typography>;
  }
  const finished = lastRun.outcome ? OUTCOME_LABELS[lastRun.outcome] : null;
  return (
    <Stack direction="row" spacing={1} useFlexGap sx={{ alignItems: "center", flexWrap: "wrap" }}>
      <Typography variant="captionMuted">
        {finished
          ? `Last run ${finished} ${formatRelativeTime(lastRun.finishedAt ?? lastRun.startedAt)} ago`
          : `Harvesting now - started ${formatRelativeTime(lastRun.startedAt)} ago`}
      </Typography>
      {lastRun.campaignId && (
        <LinkButton
          size="small"
          href={`/campaigns/${encodeURIComponent(lastRun.campaignId)}` as Route}
        >
          {lastRun.campaignQuery ?? "Open campaign"}
        </LinkButton>
      )}
    </Stack>
  );
}

/**
 * The job-alert harvest: when it runs, what is waiting, and a Run now that wakes the pilot. The pilot
 * does the harvesting, so every action here only queues work for its next cycle.
 */
export function JobAlertsPanel(): ReactElement {
  const [editing, setEditing] = useState(false);
  const { query, status } = useJobAlerts();

  const save = useApiMutation<JobAlertsStatus, PilotJobAlerts>(
    (body) => api.pilot["job-alerts"].put(body),
    {
      invalidate: [queryKeys.pilot.jobAlerts(), queryKeys.pilot.state(), queryKeys.pilot.agenda()],
      successMessage: "Job alert schedule saved.",
    },
  );

  const blocker = status ? runBlocker(status) : null;

  return (
    <SectionCard
      title="Job alert emails"
      description="Pulls every posting out of alert emails from LinkedIn, Ladders, FlexJobs and more, ranks them against your resume, and opens a campaign. Matches at or above your min score get applied to."
    >
      <QuerySection
        isLoading={query.isLoading}
        isError={query.isError}
        onRetry={() => void query.refetch()}
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
                size="small"
                color={status.settings.enabled ? "primary" : "default"}
                label={status.settings.enabled ? "Scheduled" : "Off"}
              />
              <Typography variant="body2">{scheduleSummary(status)}</Typography>
            </Stack>
            <Typography variant="body2">
              {status.pendingEmails === 0
                ? "No new alert emails waiting."
                : `${plural(status.pendingEmails, "alert email")} waiting to be harvested.`}
            </Typography>
            {status.requestedAt && (
              <Typography variant="captionMuted">
                Run queued {formatRelativeTime(status.requestedAt)} ago - it starts on the pilot's
                next cycle.
              </Typography>
            )}
            <LastRun status={status} />
            {blocker && (
              <Alert severity="info" variant="outlined">
                {blocker}
              </Alert>
            )}
            <Stack direction="row" spacing={1} sx={{ justifyContent: "flex-end" }}>
              <Button size="small" startIcon={<Schedule />} onClick={() => setEditing(true)}>
                Schedule
              </Button>
              <RunJobAlertsButton label="Run now" />
            </Stack>
          </Stack>
        )}
      </QuerySection>
      {status && (
        <ScheduleDialog
          open={editing}
          status={status}
          submitting={save.isPending}
          onClose={() => setEditing(false)}
          onSubmit={async (settings) => {
            await save.mutateAsync(settings);
            setEditing(false);
          }}
        />
      )}
    </SectionCard>
  );
}
