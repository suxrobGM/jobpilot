"use client";

import type { ReactElement } from "react";
import { type JobBoardInput, jobBoardSchema } from "@jobpilot/contracts/job-board";
import { Stack } from "@mui/material";
import { FormDialog } from "@/components/ui/form";
import { useAppForm } from "@/components/ui/form/tanstack";

interface BoardFormDialogProps {
  open: boolean;
  initial?: JobBoardInput | null;
  title: string;
  onClose: () => void;
  onSubmit: (values: JobBoardInput) => void;
  submitting?: boolean;
}

const EMPTY: JobBoardInput = {
  name: "",
  domain: "",
  searchUrl: "",
  email: "",
  password: "",
  sortOrder: 100,
};

export function BoardFormDialog(props: BoardFormDialogProps): ReactElement {
  const { open, initial, title, onClose, onSubmit, submitting } = props;
  const form = useAppForm({
    defaultValues: initial ?? EMPTY,
    validators: { onSubmit: jobBoardSchema },
    onSubmit: async ({ value }) => {
      onSubmit(value);
    },
  });

  return (
    <FormDialog open={open} title={title} onClose={onClose} form={form} submitting={submitting}>
      <Stack direction="row" spacing={2}>
        <form.AppField name="name">
          {(field) => <field.TextField label="Display name" />}
        </form.AppField>
        <form.AppField name="domain">
          {/* The domain identifies the shared board, so it is fixed once linked - remove and re-add to change it. */}
          {(field) => (
            <field.TextField label="Domain (e.g. linkedin.com)" disabled={Boolean(initial)} />
          )}
        </form.AppField>
      </Stack>
      <form.AppField name="searchUrl">
        {(field) => <field.TextField label="Search URL" />}
      </form.AppField>
      <Stack direction="row" spacing={2}>
        <form.AppField name="email">
          {(field) => <field.TextField label="Email (for login)" />}
        </form.AppField>
        <form.AppField name="password">
          {(field) => <field.TextField label="Password (for login)" type="password" />}
        </form.AppField>
      </Stack>
      <form.AppField name="sortOrder">
        {(field) => <field.TextField label="Sort order" type="number" />}
      </form.AppField>
    </FormDialog>
  );
}
