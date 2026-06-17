"use client";

import type { ReactElement } from "react";
import { RegisterSchema, type RegisterInput } from "@jobpilot/contracts/auth";
import { Alert, Link, Stack, Typography } from "@mui/material";
import NextLink from "next/link";
import { useAppForm } from "@/components/ui/form/tanstack";
import { useAuth } from "@/hooks/use-auth";

const DEFAULT_VALUES: RegisterInput = { email: "", password: "" };

export function RegisterForm(): ReactElement {
  const { register } = useAuth();

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
              helperText="8+ characters with an uppercase letter, a lowercase letter, a number, and a special character."
            />
          )}
        </form.AppField>

        <form.AppForm>
          <form.SubmitButton disabled={register.isPending} fullWidth size="large">
            {register.isPending ? "Creating account…" : "Create account"}
          </form.SubmitButton>
        </form.AppForm>

        <Typography variant="body2Muted" sx={{ textAlign: "center" }}>
          Already have an account?{" "}
          <Link component={NextLink} href="/login" color="primary">
            Sign in
          </Link>
        </Typography>
      </Stack>
    </form>
  );
}
