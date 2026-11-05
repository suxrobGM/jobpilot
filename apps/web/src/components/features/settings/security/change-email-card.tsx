"use client";

import type { ReactElement } from "react";
import { type ChangeEmailInput, ChangeEmailSchema } from "@jobpilot/contracts/auth";
import { Alert, Stack, Typography } from "@mui/material";
import { api } from "@/api/client";
import { useApiMutation } from "@/api/hooks";
import { useAppForm } from "@/components/ui/form/tanstack";
import { SectionCard } from "@/components/ui/layout";
import { useSession } from "@/hooks/use-auth";

const DEFAULT_VALUES: ChangeEmailInput = { newEmail: "", currentPassword: "" };

/** Two-step change: a confirmation link goes to the new address; nothing switches until clicked. */
export function ChangeEmailCard(): ReactElement {
  const { user } = useSession();

  const changeEmail = useApiMutation((body: ChangeEmailInput) => api.auth.email.change.post(body), {
    showErrorToast: false,
  });

  const form = useAppForm({
    defaultValues: DEFAULT_VALUES,
    validators: { onSubmit: ChangeEmailSchema },
    onSubmit: async ({ value }) => {
      await changeEmail.mutateAsync(value);
      form.reset();
    },
  });

  return (
    <SectionCard
      title="Sign-in email"
      description="The address you sign in with. Changing it requires confirming the new address first."
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          form.handleSubmit();
        }}
      >
        <Stack spacing={2.5} sx={{ maxWidth: 420 }}>
          <Typography variant="body2">
            Current email: <strong>{user?.email}</strong>
          </Typography>

          {changeEmail.error && <Alert severity="error">{changeEmail.error.message}</Alert>}
          {changeEmail.isSuccess && (
            <Alert severity="success">
              Check <strong>{changeEmail.variables?.newEmail}</strong> - your address switches once
              you click the link. It expires in 1 hour.
            </Alert>
          )}

          <form.AppField name="newEmail">
            {(field) => (
              <field.TextField
                label="New email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
              />
            )}
          </form.AppField>

          {user?.hasPassword && (
            <form.AppField name="currentPassword">
              {(field) => (
                <field.TextField
                  label="Current password"
                  type="password"
                  autoComplete="current-password"
                />
              )}
            </form.AppField>
          )}

          <form.AppForm>
            <form.SubmitButton loading={changeEmail.isPending}>
              Send confirmation link
            </form.SubmitButton>
          </form.AppForm>
        </Stack>
      </form>
    </SectionCard>
  );
}
