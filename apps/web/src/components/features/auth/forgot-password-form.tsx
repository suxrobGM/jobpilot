"use client";

import type { ReactElement } from "react";
import { type ForgotPasswordInput, ForgotPasswordSchema } from "@jobpilot/contracts/auth";
import { Alert, Link, Stack, Typography } from "@mui/material";
import { api } from "@/api/client";
import { useApiMutation } from "@/api/hooks";
import { useAppForm } from "@/components/ui/form/tanstack";

const DEFAULT_VALUES: ForgotPasswordInput = { email: "" };

export function ForgotPasswordForm(): ReactElement {
  const forgotPassword = useApiMutation((body: ForgotPasswordInput) =>
    api.auth.password.reset.post(body),
  );

  const form = useAppForm({
    defaultValues: DEFAULT_VALUES,
    validators: { onSubmit: ForgotPasswordSchema },
    onSubmit: ({ value }) => forgotPassword.mutateAsync(value),
  });

  if (forgotPassword.isSuccess) {
    return (
      <Stack spacing={2.5}>
        <Alert severity="success">
          If an account exists for that address, we&apos;ve sent a password reset link. Check your
          inbox.
        </Alert>
        <Typography variant="body2Muted" sx={{ textAlign: "center" }}>
          <Link href="/login" color="primary">
            Back to sign in
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
        {forgotPassword.error && <Alert severity="error">{forgotPassword.error.message}</Alert>}

        <form.AppField name="email">
          {(field) => (
            <field.TextField
              label="Email"
              type="email"
              autoComplete="email"
              autoFocus
              placeholder="you@example.com"
            />
          )}
        </form.AppField>

        <form.AppForm>
          <form.SubmitButton disabled={forgotPassword.isPending} fullWidth size="large">
            {forgotPassword.isPending ? "Sending…" : "Send reset link"}
          </form.SubmitButton>
        </form.AppForm>

        <Typography variant="body2Muted" sx={{ textAlign: "center" }}>
          Remembered it?{" "}
          <Link href="/login" color="primary">
            Sign in
          </Link>
        </Typography>
      </Stack>
    </form>
  );
}
