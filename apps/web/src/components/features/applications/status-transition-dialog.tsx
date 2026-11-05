"use client";

import type { ReactElement } from "react";
import {
  APPLICATION_STATUSES,
  type ApplicationStatus,
  type StatusTransitionInput,
} from "@jobpilot/contracts/application";
import { z } from "zod/v4";
import { statusOptions } from "@/components/ui/display";
import { FormDialog } from "@/components/ui/form";
import { useAppForm } from "@/components/ui/form/tanstack";

const STATUS_ITEMS = statusOptions("application");

interface StatusTransitionDialogProps {
  open: boolean;
  currentStatus: ApplicationStatus;
  onClose: () => void;
  onSubmit: (next: StatusTransitionInput) => void;
  submitting?: boolean;
}

export function StatusTransitionDialog(props: StatusTransitionDialogProps): ReactElement {
  const { open, currentStatus, onClose, onSubmit, submitting } = props;

  const schema = z.object({
    toStatus: z
      .enum(APPLICATION_STATUSES)
      .refine((status) => status !== currentStatus, "Pick a status other than the current one"),
    note: z.string(),
  });

  const form = useAppForm({
    defaultValues: { toStatus: currentStatus, note: "" },
    validators: { onSubmit: schema },
    onSubmit: async ({ value }) => {
      onSubmit({ toStatus: value.toStatus, note: value.note.trim() || null });
    },
  });

  return (
    <FormDialog
      open={open}
      title="Update status"
      onClose={onClose}
      form={form}
      submitting={submitting}
    >
      <form.AppField name="toStatus">
        {(field) => <field.Select label="New status" items={STATUS_ITEMS} />}
      </form.AppField>
      <form.AppField name="note">
        {(field) => <field.TextField label="Note (optional)" multiline rows={3} />}
      </form.AppField>
    </FormDialog>
  );
}
