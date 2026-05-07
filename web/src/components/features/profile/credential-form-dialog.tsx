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
import { FormTextField } from "@/components/ui/form/form-text-field";
import { type CredentialInput, credentialSchema } from "@/lib/schemas/credential";

interface CredentialFormDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: CredentialInput) => void;
  submitting?: boolean;
}

export function CredentialFormDialog(props: CredentialFormDialogProps): ReactElement {
  const { open, onClose, onSubmit, submitting } = props;
  const form = useForm({
    defaultValues: { scope: "default", email: "", password: "" } as CredentialInput,
    validators: { onSubmit: credentialSchema },
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
        <DialogTitle>Add credential</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <FormTextField
              form={form}
              name="scope"
              label="Scope"
              helperText='Use "default" or a domain like "linkedin.com"'
            />
            <FormTextField form={form} name="email" label="Email or username" />
            <FormTextField form={form} name="password" label="Password" type="password" />
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
