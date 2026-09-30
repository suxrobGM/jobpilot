"use client";

import type { ReactElement } from "react";
import {
  type JobAlertsStatus,
  type PilotJobAlerts,
  timeZoneSchema,
} from "@jobpilot/contracts/pilot";
import { Typography } from "@mui/material";
import { z } from "zod/v4";
import { FormDialog } from "@/components/ui/form";
import { useAppForm } from "@/components/ui/form/tanstack";

/** Every whole hour as a run-time option, "00:00" through "23:00". */
const RUN_TIME_OPTIONS = Array.from({ length: 24 }, (_, hour) => hourLabel(hour));

function hourLabel(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`;
}

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
    runTimes: settings.runHours.map(hourLabel),
    // A harvest never switched on still carries the schema's UTC; offer the viewer's own zone.
    timeZone: settings.enabled ? settings.timeZone : browserTimeZone(),
    extraSenderDomains: settings.extraSenderDomains,
  };
}

interface ScheduleDialogProps {
  open: boolean;
  status: JobAlertsStatus;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (settings: PilotJobAlerts) => Promise<void>;
}

export function ScheduleDialog(props: ScheduleDialogProps): ReactElement {
  const { open, status, submitting, onClose, onSubmit } = props;

  const form = useAppForm({
    defaultValues: toFormValues(status),
    validators: { onSubmit: scheduleFormSchema },
    onSubmit: async ({ value }) => {
      await onSubmit({
        enabled: value.enabled,
        runHours: value.runTimes.map((label) => Number(label.slice(0, 2))),
        timeZone: value.timeZone.trim(),
        extraSenderDomains: value.extraSenderDomains,
      });
    },
  });

  const handleClose = (): void => {
    form.reset(toFormValues(status));
    onClose();
  };

  return (
    <FormDialog
      open={open}
      title="Job alert email schedule"
      onClose={handleClose}
      form={form}
      submitting={submitting}
    >
      <form.AppField name="enabled">
        {(field) => <field.Switch label="Harvest job alert emails on a schedule" />}
      </form.AppField>
      <form.AppField name="runTimes">
        {(field) => (
          <field.Multiselect
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
          <field.Multiselect
            label="Extra sender domains"
            placeholder="e.g. jobs.example.com"
            helperText="Press Enter to add a domain. Subdomains match too."
          />
        )}
      </form.AppField>
      <Typography variant="captionMuted">
        Always included: {status.builtInSenderDomains.join(", ")}.
      </Typography>
    </FormDialog>
  );
}
