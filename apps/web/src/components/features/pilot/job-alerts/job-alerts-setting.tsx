"use client";

import { type ReactElement, useState } from "react";
import type { JobAlertsStatus } from "@jobpilot/contracts/pilot";
import { Schedule } from "@mui/icons-material";
import { Button, Stack, Switch, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { pilotQueries } from "@/api/queries";
import { FormSection } from "@/components/ui/form";
import { formatTimeUntil, plural } from "@/utils/format";
import { formatHour } from "../run-status";
import { RunJobAlertsButton } from "./run-job-alerts-button";
import { ScheduleDialog } from "./schedule-dialog";

function scheduleSummary(status: JobAlertsStatus): string {
  const { settings } = status;
  if (!settings.enabled) {
    return "Off - imports only when you click Run now.";
  }
  const times = settings.runHours.map(formatHour).join(", ");
  const next = status.nextRunAt ? ` · next in ${formatTimeUntil(status.nextRunAt)}` : "";
  return `Daily at ${times} ${settings.timeZone}${next}`;
}

/** The job-alert import's schedule; the toggle opens the schedule dialog, which owns the save. */
export function JobAlertsSetting(): ReactElement {
  const [editing, setEditing] = useState(false);
  const status = useQuery(pilotQueries.jobAlerts()).data;

  return (
    <FormSection
      title="Job alert emails"
      description="Imports postings from LinkedIn, Ladders, FlexJobs and other alert emails, then scores them against your resume."
    >
      {status && (
        <Stack spacing={1}>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}>
            <Switch
              checked={status.settings.enabled}
              onChange={() => setEditing(true)}
              slotProps={{ input: { "aria-label": "Schedule job alert imports" } }}
            />
            <Typography variant="body2" sx={{ flex: 1, minWidth: 0 }}>
              {scheduleSummary(status)}
            </Typography>
            <Button size="small" startIcon={<Schedule />} onClick={() => setEditing(true)}>
              Schedule
            </Button>
            <RunJobAlertsButton status={status} />
          </Stack>
          {status.pendingEmails > 0 && (
            <Typography variant="captionMuted">
              {plural(status.pendingEmails, "alert email")} waiting to be imported.
            </Typography>
          )}
          <ScheduleDialog open={editing} status={status} onClose={() => setEditing(false)} />
        </Stack>
      )}
    </FormSection>
  );
}
