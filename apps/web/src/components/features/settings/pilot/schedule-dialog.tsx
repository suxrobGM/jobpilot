"use client";

import type { ReactElement } from "react";
import {
  JOB_ALERT_SENDER_DOMAINS,
  type JobAlertsStatus,
  type PilotJobAlerts,
  timeZoneSchema,
} from "@jobpilot/contracts/pilot";
import { Typography } from "@mui/material";
import { z } from "zod/v4";
import { api } from "@/api/client";
import { pilotQueries } from "@/api/queries";
import { useApiMutation } from "@/api/use-api-mutation";
import { FormDialog } from "@/components/ui/form";
import { useAppForm } from "@/components/ui/form/tanstack";
import { formatHour } from "@/utils/format";

/** Every whole hour as a run-time option, "00:00" through "23:00". */
const RUN_TIME_OPTIONS = Array.from({ length: 24 }, (_, hour) => formatHour(hour));

function browserTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

// "08:00"-style labels: the multi-select binds strings, the API stores hours.
const scheduleFormSchema = z.object({
  enabled: z.boolean(),
  runTimes: z.array(z.string()).min(1, "Pick at least one time of day."),
  timeZone: timeZoneSchema,
  extraSenderDomains: z.array(z.string()),
});

type ScheduleFormValues = z.infer<typeof scheduleFormSchema>;

function toFormValues(status: JobAlertsStatus): ScheduleFormValues {
  const { settings } = status;
  return {
    enabled: settings.enabled,
    runTimes: settings.runHours.map(formatHour),
    // A schedule never switched on still carries the schema's UTC; offer the viewer's own zone.
    timeZone: settings.enabled ? settings.timeZone : browserTimeZone(),
    extraSenderDomains: settings.extraSenderDomains,
  };
}

interface ScheduleDialogProps {
  open: boolean;
  status: JobAlertsStatus;
  onClose: () => void;
}

export function ScheduleDialog(props: ScheduleDialogProps): ReactElement {
  const { open, status, onClose } = props;
  const save = useApiMutation((body: PilotJobAlerts) => api.pilot["job-alerts"].put(body), {
    invalidate: [pilotQueries.jobAlerts().queryKey, pilotQueries.taskList().queryKey],
    successMessage: "Job alert schedule saved.",
  });

  const form = useAppForm({
    defaultValues: toFormValues(status),
    validators: { onSubmit: scheduleFormSchema },
    onSubmit: async ({ value }) => {
      await save.mutateAsync({
        enabled: value.enabled,
        runHours: value.runTimes.map((label) => Number(label.slice(0, 2))),
        timeZone: value.timeZone.trim(),
        extraSenderDomains: value.extraSenderDomains,
      });
      onClose();
    },
  });

  const handleClose = (): void => {
    form.reset(toFormValues(status));
    onClose();
  };

  return (
    <FormDialog open={open} title="Job alert email schedule" onClose={handleClose} form={form}>
      <form.AppField name="enabled">
        {(field) => <field.Switch label="Import job alert emails on a schedule" />}
      </form.AppField>
      <form.AppField name="runTimes">
        {(field) => (
          <field.MultiSelect
            label="Run times"
            options={RUN_TIME_OPTIONS}
            freeSolo={false}
            helperText="A couple of times a day is plenty."
          />
        )}
      </form.AppField>
      <form.AppField name="timeZone">
        {(field) => (
          <field.TextField label="Time zone" helperText="IANA name, e.g. America/Detroit." />
        )}
      </form.AppField>
      <form.AppField name="extraSenderDomains">
        {(field) => (
          <field.MultiSelect
            label="Extra sender domains"
            placeholder="e.g. jobs.example.com"
            helperText="Press Enter to add a domain. Subdomains match too."
          />
        )}
      </form.AppField>
      <Typography variant="captionMuted">
        Always included: {JOB_ALERT_SENDER_DOMAINS.join(", ")}.
      </Typography>
    </FormDialog>
  );
}
