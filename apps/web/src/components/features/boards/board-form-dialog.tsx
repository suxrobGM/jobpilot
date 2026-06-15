"use client";

import type { ReactElement } from "react";
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack } from "@mui/material";
import { jobBoardSchema, type JobBoardInput } from "@jobpilot/contracts/job-board";
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
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          form.handleSubmit();
        }}
      >
        <DialogTitle>{title}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
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
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <form.AppForm>
            <form.SubmitButton disabled={submitting}>Save</form.SubmitButton>
          </form.AppForm>
        </DialogActions>
      </form>
    </Dialog>
  );
}
