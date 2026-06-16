"use client";

import { useState, type ReactElement } from "react";
import {
  credentialSchema,
  SERVICE_PROVIDERS,
  type CredentialInput,
} from "@jobpilot/contracts/credential";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
} from "@mui/material";
import { useAppForm } from "@/components/ui/form/tanstack";

interface CredentialFormDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: CredentialInput) => void;
  submitting?: boolean;
}

type CredentialKind = "login" | "service";

const PROVIDER_ITEMS = SERVICE_PROVIDERS.map((p) => ({
  value: p,
  label: p === "2captcha" ? "2Captcha" : "CapSolver",
}));

export function CredentialFormDialog(props: CredentialFormDialogProps): ReactElement {
  const { open, onClose, onSubmit, submitting } = props;
  const [kind, setKind] = useState<CredentialKind>("login");

  const form = useAppForm({
    defaultValues: { scope: "default", email: "", password: "", apiKey: "" } as CredentialInput,
    validators: { onSubmit: credentialSchema },
    onSubmit: async ({ value }) => {
      // Send only the fields for the chosen shape so the unused columns persist as null.
      onSubmit(
        kind === "service"
          ? { scope: value.scope, apiKey: value.apiKey }
          : { scope: value.scope, email: value.email, password: value.password },
      );
    },
  });

  const switchKind = (next: CredentialKind): void => {
    setKind(next);
    if (next === "service") {
      form.setFieldValue("scope", SERVICE_PROVIDERS[0]);
      form.setFieldValue("email", "");
      form.setFieldValue("password", "");
    } else {
      form.setFieldValue("scope", "default");
      form.setFieldValue("apiKey", "");
    }
  };

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
            <ToggleButtonGroup
              exclusive
              size="small"
              color="primary"
              value={kind}
              onChange={(_, next) => next && switchKind(next)}
            >
              <ToggleButton value="login">Login</ToggleButton>
              <ToggleButton value="service">Captcha service</ToggleButton>
            </ToggleButtonGroup>

            {kind === "login" && (
              <>
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
              </>
            )}

            {kind === "service" && (
              <>
                <form.AppField name="scope">
                  {(field) => <field.Select label="Provider" items={PROVIDER_ITEMS} />}
                </form.AppField>
                <form.AppField name="apiKey">
                  {(field) => (
                    <field.TextField
                      label="API key"
                      type="password"
                      helperText="Used by the solve-captcha skill to solve image challenges"
                    />
                  )}
                </form.AppField>
              </>
            )}
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
