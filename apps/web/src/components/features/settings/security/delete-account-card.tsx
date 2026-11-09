"use client";

import type { ReactNode } from "react";
import { type DeleteAccountInput, DeleteAccountSchema } from "@jobpilot/contracts/auth";
import { Alert, Stack } from "@mui/material";
import { useAppForm } from "@/components/ui/form/tanstack";
import { SectionCard } from "@/components/ui/layout";
import { useAuthActions, useSession } from "@/hooks/use-auth";
import { useConfirm } from "@/providers/confirm-provider";

const DEFAULT_VALUES: DeleteAccountInput = { currentPassword: "" };

/** Hard delete; shown to the super admin too, whose request the API rejects with 403. */
export function DeleteAccountCard(): ReactNode {
  const user = useSession();
  const confirm = useConfirm();
  const { deleteAccount } = useAuthActions();

  const form = useAppForm({
    defaultValues: DEFAULT_VALUES,
    validators: { onSubmit: DeleteAccountSchema },
    onSubmit: async ({ value }) => {
      const confirmed = await confirm({
        title: "Delete your account?",
        description:
          "This permanently erases your account and everything in it. It can't be undone.",
        confirmLabel: "Delete account",
        destructive: true,
        confirmationText: user?.email,
        confirmationHint: "Type your email to confirm.",
      });
      if (confirmed) {
        await deleteAccount.mutateAsync(value);
      }
    },
  });

  if (!user) {
    return null;
  }

  return (
    <SectionCard
      title="Delete account"
      description="Permanently erases your profile, resumes, applications, searches, Pilot history, connected mailbox, and saved credentials. The agent stops working right away."
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          form.handleSubmit();
        }}
      >
        <Stack spacing={2.5} sx={{ maxWidth: 420 }}>
          {deleteAccount.error && <Alert severity="error">{deleteAccount.error.message}</Alert>}

          {user.hasPassword && (
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
            <form.SubmitButton color="error">Delete account</form.SubmitButton>
          </form.AppForm>
        </Stack>
      </form>
    </SectionCard>
  );
}
