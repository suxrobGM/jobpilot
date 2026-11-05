"use client";

import type { ReactElement } from "react";
import { type ChangePasswordInput, ChangePasswordSchema } from "@jobpilot/contracts/auth";
import { Alert, Stack } from "@mui/material";
import { api } from "@/api/client";
import { authQueries } from "@/api/queries";
import { useApiMutation } from "@/api/use-api-mutation";
import { PASSWORD_HINT } from "@/components/features/auth/password-hint";
import { useAppForm } from "@/components/ui/form/tanstack";
import { SectionCard } from "@/components/ui/layout";
import { useSession } from "@/hooks/use-auth";

const DEFAULT_VALUES: ChangePasswordInput = { currentPassword: "", newPassword: "" };

/** Change, or first-set for OAuth-only accounts. */
export function ChangePasswordCard(): ReactElement {
  const { user } = useSession();
  const hasPassword = user?.hasPassword ?? true;

  const changePassword = useApiMutation(
    (body: ChangePasswordInput) => api.auth.password.change.post(body),
    {
      showErrorToast: false,
      successMessage: hasPassword ? "Password updated" : "Password set",
      // hasPassword flips for OAuth-only accounts setting their first password.
      invalidate: [authQueries.me().queryKey],
    },
  );

  const form = useAppForm({
    defaultValues: DEFAULT_VALUES,
    validators: { onSubmit: ChangePasswordSchema },
    onSubmit: async ({ value }) => {
      await changePassword.mutateAsync(value);
      form.reset();
    },
  });

  return (
    <SectionCard
      title={hasPassword ? "Password" : "Set a password"}
      description={
        hasPassword
          ? "Changing your password signs you out everywhere except this session."
          : "Add a password to also sign in with your email, alongside your connected account."
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          form.handleSubmit();
        }}
      >
        <Stack spacing={2.5} sx={{ maxWidth: 420 }}>
          {changePassword.error && <Alert severity="error">{changePassword.error.message}</Alert>}

          {hasPassword && (
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

          <form.AppField name="newPassword">
            {(field) => (
              <field.TextField
                label="New password"
                type="password"
                autoComplete="new-password"
                helperText={PASSWORD_HINT}
              />
            )}
          </form.AppField>

          <form.AppForm>
            <form.SubmitButton>
              {hasPassword ? "Change password" : "Set password"}
            </form.SubmitButton>
          </form.AppForm>
        </Stack>
      </form>
    </SectionCard>
  );
}
