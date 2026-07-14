"use client";

import { type ReactElement, useState } from "react";
import {
  type CredentialInput,
  credentialSchema,
  SERVICE_PROVIDERS,
} from "@jobpilot/contracts/credential";
import { ToggleButton, ToggleButtonGroup } from "@mui/material";
import { FormDialog } from "@/components/ui/form";
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

  // Reset the form and tab so reopening starts clean instead of showing stale input.
  const handleClose = (): void => {
    form.reset();
    setKind("login");
    onClose();
  };

  return (
    <FormDialog
      open={open}
      title="Add credential"
      onClose={handleClose}
      form={form}
      submitting={submitting}
    >
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
    </FormDialog>
  );
}
