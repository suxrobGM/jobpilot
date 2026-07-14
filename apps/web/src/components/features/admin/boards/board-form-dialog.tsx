"use client";

import type { ReactElement } from "react";
import { type AdminBoardInput, adminBoardSchema } from "@jobpilot/contracts/job-board";
import { Stack } from "@mui/material";
import { FormDialog } from "@/components/ui/form";
import { useAppForm } from "@/components/ui/form/tanstack";

interface AdminBoardFormDialogProps {
  open: boolean;
  initial?: AdminBoardInput | null;
  title: string;
  onClose: () => void;
  onSubmit: (values: AdminBoardInput) => void;
  submitting?: boolean;
}

const EMPTY: AdminBoardInput = {
  name: "",
  domain: "",
  searchUrl: "",
  listed: true,
  isDefault: false,
  sortOrder: 100,
};

export function AdminBoardFormDialog(props: AdminBoardFormDialogProps): ReactElement {
  const { open, initial, title, onClose, onSubmit, submitting } = props;
  const form = useAppForm({
    defaultValues: initial ?? EMPTY,
    validators: { onSubmit: adminBoardSchema },
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
          {(field) => <field.TextField label="Domain (e.g. linkedin.com)" />}
        </form.AppField>
      </Stack>
      <form.AppField name="searchUrl">
        {(field) => <field.TextField label="Search URL" />}
      </form.AppField>
      <form.AppField name="sortOrder">
        {(field) => <field.TextField label="Sort order" type="number" />}
      </form.AppField>
      <form.AppField name="listed">
        {(field) => <field.Switch label="Listed - offer this board to every user" />}
      </form.AppField>
      <form.AppField name="isDefault">
        {(field) => <field.Switch label="Default - add it to new accounts automatically" />}
      </form.AppField>
    </FormDialog>
  );
}
