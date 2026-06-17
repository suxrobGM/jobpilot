"use client";

import type { ReactElement } from "react";
import { ResetPasswordSchema, type ResetPasswordInput } from "@jobpilot/contracts/auth";
import { Alert, Link, Stack, Typography } from "@mui/material";
import NextLink from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/api/eden";
import { useApiMutation } from "@/api/hooks";
import type { ResetPasswordResponse } from "@/api/types";
import { useAppForm } from "@/components/ui/form/tanstack";
import { useToast } from "@/providers/notification-provider";

interface ResetPasswordFormProps {
  token: string;
}

export function ResetPasswordForm(props: ResetPasswordFormProps): ReactElement {
  const { token } = props;
  const router = useRouter();
  const toast = useToast();
  const resetPassword = useApiMutation<ResetPasswordResponse, ResetPasswordInput>((body) =>
    api.auth.password.reset.post(body),
  );

  const form = useAppForm({
    defaultValues: { token, password: "" } satisfies ResetPasswordInput,
    validators: { onSubmit: ResetPasswordSchema },
    onSubmit: async ({ value }) => {
      await resetPassword.mutateAsync(value);
      toast.success("Password updated. Please sign in.");
      router.push("/login");
    },
  });

  if (!token) {
    return (
      <Stack spacing={2.5}>
        <Alert severity="error">
          This reset link is missing its token. Request a new one below.
        </Alert>
        <Typography variant="body2Muted" sx={{ textAlign: "center" }}>
          <Link component={NextLink} href="/forgot-password" color="primary">
            Request a new link
          </Link>
        </Typography>
      </Stack>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        form.handleSubmit();
      }}
    >
      <Stack spacing={2.5}>
        {resetPassword.error && <Alert severity="error">{resetPassword.error.message}</Alert>}

        <form.AppField name="password">
          {(field) => (
            <field.TextField
              label="New password"
              type="password"
              autoComplete="new-password"
              autoFocus
              helperText="8+ characters with an uppercase letter, a lowercase letter, a number, and a special character."
            />
          )}
        </form.AppField>

        <form.AppForm>
          <form.SubmitButton disabled={resetPassword.isPending} fullWidth size="large">
            {resetPassword.isPending ? "Updating…" : "Update password"}
          </form.SubmitButton>
        </form.AppForm>

        <Typography variant="body2Muted" sx={{ textAlign: "center" }}>
          <Link component={NextLink} href="/login" color="primary">
            Back to sign in
          </Link>
        </Typography>
      </Stack>
    </form>
  );
}
