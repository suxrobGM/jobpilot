"use client";

import type { ReactElement } from "react";
import { type RegisterInput, RegisterSchema } from "@jobpilot/contracts/auth";
import { Alert, Link, Stack, Typography } from "@mui/material";
import { useAppForm } from "@/components/ui/form/tanstack";
import { useAuthActions } from "@/hooks/use-auth";
import { OAuthButtons } from "./oauth-buttons";
import { PASSWORD_HINT } from "./password-hint";

const DEFAULT_VALUES: RegisterInput = { email: "", password: "" };

export function RegisterForm(): ReactElement {
  const { register } = useAuthActions();

  const form = useAppForm({
    defaultValues: DEFAULT_VALUES,
    validators: { onSubmit: RegisterSchema },
    onSubmit: async ({ value }) => {
      await register.mutateAsync(value);
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
        {register.error && <Alert severity="error">{register.error.message}</Alert>}

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
            <field.TextField
              label="Password"
              type="password"
              autoComplete="new-password"
              helperText={PASSWORD_HINT}
            />
          )}
        </form.AppField>

        <form.AppForm>
          <form.SubmitButton fullWidth size="large">
            Create account
          </form.SubmitButton>
        </form.AppForm>

        <OAuthButtons />

        <Typography variant="body2Muted" sx={{ textAlign: "center" }}>
          Already have an account?{" "}
          <Link href="/login" color="primary">
            Sign in
          </Link>
        </Typography>
      </Stack>
    </form>
  );
}
