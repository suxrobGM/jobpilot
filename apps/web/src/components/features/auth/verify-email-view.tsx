"use client";

import type { ReactElement } from "react";
import type { VerifyEmailInput } from "@jobpilot/contracts/auth";
import { Alert, Button, Stack, Typography } from "@mui/material";
import { useSearchParams } from "next/navigation";
import { api } from "@/api/client";
import { useApiMutation } from "@/api/use-api-mutation";
import { useAuthActions, useSession } from "@/hooks/use-auth";
import { MagicLinkView } from "./magic-link-view";

/** With a `token`, confirms the address; without one, it is the gate for an unverified user. */
export function VerifyEmailView(): ReactElement {
  const token = useSearchParams().get("token");
  return token ? <VerifyTokenView token={token} /> : <VerifyGateView />;
}

interface VerifyTokenViewProps {
  token: string;
}

function VerifyTokenView(props: VerifyTokenViewProps): ReactElement {
  const { token } = props;
  const verifyEmail = useApiMutation(
    (body: VerifyEmailInput) => api.auth.email.verification.confirm.post(body),
    { showErrorToast: false },
  );

  return (
    <MagicLinkView
      token={token}
      mutation={verifyEmail}
      pendingText="Verifying your email…"
      successText="Your email is verified."
      successLabel="Continue"
      successHref="/pilot"
      errorHint="This link may have expired or already been used."
    />
  );
}

function VerifyGateView(): ReactElement {
  const { user } = useSession();
  const { logout } = useAuthActions();
  const resendVerification = useApiMutation(() => api.auth.email.verification.post(), {
    showErrorToast: false,
  });

  return (
    <Stack spacing={2.5}>
      <Typography variant="body2">
        We&apos;ve sent a verification link to{" "}
        {user?.email ? <strong>{user.email}</strong> : "your email"}. Click it to activate your
        account, then come back here.
      </Typography>

      {resendVerification.isSuccess && (
        <Alert severity="success">Verification email sent - check your inbox.</Alert>
      )}
      {resendVerification.error && (
        <Alert severity="error">{resendVerification.error.message}</Alert>
      )}

      <Button
        variant="contained"
        size="large"
        fullWidth
        onClick={() => resendVerification.mutate()}
        loading={resendVerification.isPending}
      >
        Resend email
      </Button>

      <Button variant="text" fullWidth onClick={() => logout.mutate()} disabled={logout.isPending}>
        Sign out
      </Button>
    </Stack>
  );
}
