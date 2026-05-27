"use client";

import type { ReactElement } from "react";
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack } from "@mui/material";
import { useAppForm } from "@/components/ui/form/tanstack";
import { credentialSchema, type CredentialInput } from "@/lib/schemas/credential";

interface CredentialFormDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: CredentialInput) => void;
  submitting?: boolean;
}

export function CredentialFormDialog(props: CredentialFormDialogProps): ReactElement {
  const { open, onClose, onSubmit, submitting } = props;
  const form = useAppForm({
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
            <form.AppField name="scope">
              {(field) => (
                <field.TextField
                  label="Scope"
                  helperText='Use "default" or a domain like "linkedin.com"'
                />
              )}
            </form.AppField>
            <form.AppField name="email">
              {(field) => <field.TextField label="Email or username" />}
            </form.AppField>
            <form.AppField name="password">
              {(field) => <field.TextField label="Password" type="password" />}
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
