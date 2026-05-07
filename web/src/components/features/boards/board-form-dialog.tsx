"use client";

import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
} from "@mui/material";
import { useForm } from "@tanstack/react-form";
import type { ReactElement } from "react";
import { FormSelectField } from "@/components/ui/form/form-select-field";
import { FormSwitchField } from "@/components/ui/form/form-switch-field";
import { FormTextField } from "@/components/ui/form/form-text-field";
import type { AnyReactForm } from "@/components/ui/form/types";
import { type JobBoardInput, jobBoardSchema } from "@/lib/schemas/job-board";

interface BoardFormDialogProps {
  open: boolean;
  initial?: JobBoardInput | null;
  title: string;
  onClose: () => void;
  onSubmit: (values: JobBoardInput) => void;
  submitting?: boolean;
}

const TYPE_ITEMS = [
  { value: "search", label: "Search board (LinkedIn, Indeed, …)" },
  { value: "ats", label: "ATS (Greenhouse, Lever, Workday, …)" },
];

const EMPTY: JobBoardInput = {
  name: "",
  domain: "",
  searchUrl: "",
  type: "search",
  enabled: true,
  email: "",
  password: "",
  sortOrder: 100,
};

export function BoardFormDialog(props: BoardFormDialogProps): ReactElement {
  const { open, initial, title, onClose, onSubmit, submitting } = props;
  const form = useForm({
    defaultValues: initial ?? EMPTY,
    validators: { onSubmit: jobBoardSchema },
    onSubmit: async ({ value }) => {
      onSubmit(value);
    },
  });
  const formApi = form as unknown as AnyReactForm;

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
              <FormTextField form={formApi} name="name" label="Display name" />
              <FormTextField form={formApi} name="domain" label="Domain (e.g. linkedin.com)" />
            </Stack>
            <FormTextField form={formApi} name="searchUrl" label="Search URL (search boards only)" />
            <FormSelectField form={formApi} name="type" label="Type" items={TYPE_ITEMS} />
            <Stack direction="row" spacing={2}>
              <FormTextField form={formApi} name="email" label="Email override (optional)" />
              <FormTextField
                form={formApi}
                name="password"
                label="Password override (optional)"
                type="password"
              />
            </Stack>
            <FormTextField form={formApi} name="sortOrder" label="Sort order" type="number" />
            <FormSwitchField form={formApi} name="enabled" label="Enabled" />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={submitting}>
            Save
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
