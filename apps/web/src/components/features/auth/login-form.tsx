"use client";

import type { ReactElement } from "react";
import { type LoginInput, LoginSchema } from "@jobpilot/contracts/auth";
import { Alert, Link, Stack, Typography } from "@mui/material";
import { useAppForm } from "@/components/ui/form/tanstack";
import { useAuthActions } from "@/hooks/use-auth";
import { OAuthButtons } from "./oauth-buttons";
import { OAuthErrorAlert } from "./oauth-error-alert";

const DEFAULT_VALUES: LoginInput = { email: "", password: "" };

export function LoginForm(): ReactElement {
  const { login } = useAuthActions();

  const form = useAppForm({
    defaultValues: DEFAULT_VALUES,
    validators: { onSubmit: LoginSchema },
    onSubmit: async ({ value }) => {
      await login.mutateAsync(value);
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        form.handleSubmit();
      }}
    >
      <Stack spacing={2.5}>
        <OAuthErrorAlert suppressed={!!login.error} />
        {login.error && <Alert severity="error">{login.error.message}</Alert>}

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

        <form.AppField name="password">
          {(field) => (
            <field.TextField label="Password" type="password" autoComplete="current-password" />
          )}
        </form.AppField>

        <Typography variant="body2Muted" sx={{ textAlign: "right", mt: -1 }}>
          <Link href="/forgot-password" color="primary">
            Forgot password?
          </Link>
        </Typography>

        <form.AppForm>
          <form.SubmitButton disabled={login.isPending} fullWidth size="large">
            {login.isPending ? "Signing in…" : "Sign in"}
          </form.SubmitButton>
        </form.AppForm>

        <OAuthButtons />

        <Typography variant="body2Muted" sx={{ textAlign: "center" }}>
          No account?{" "}
          <Link href="/register" color="primary">
            Create one
          </Link>
        </Typography>
      </Stack>
    </form>
  );
}
