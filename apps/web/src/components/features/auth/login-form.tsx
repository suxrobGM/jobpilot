"use client";

import type { ReactElement } from "react";
import { LoginSchema, type LoginInput } from "@jobpilot/contracts/auth";
import { Alert, Link, Stack, Typography } from "@mui/material";
import NextLink from "next/link";
import { useAppForm } from "@/components/ui/form/tanstack";
import { useAuth } from "@/hooks/use-auth";

const DEFAULT_VALUES: LoginInput = { email: "", password: "" };

export function LoginForm(): ReactElement {
  const { login } = useAuth();

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

        <form.AppForm>
          <form.SubmitButton disabled={login.isPending} fullWidth size="large">
            {login.isPending ? "Signing in…" : "Sign in"}
          </form.SubmitButton>
        </form.AppForm>

        <Typography variant="body2Muted" sx={{ textAlign: "center" }}>
          No account?{" "}
          <Link component={NextLink} href="/register" color="primary">
            Create one
          </Link>
        </Typography>
      </Stack>
    </form>
  );
}
