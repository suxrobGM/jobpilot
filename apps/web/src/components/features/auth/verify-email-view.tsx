"use client";

import { type ReactElement, useEffect, useRef } from "react";
import type { VerifyEmailInput } from "@jobpilot/contracts/auth";
import { Alert, Box, Button, Link, Stack, Typography } from "@mui/material";
import { useRouter } from "next/navigation";
import { api } from "@/api/client";
import { useApiMutation } from "@/api/hooks";
import type { ResendVerificationResponse, VerifyEmailResponse } from "@/api/types";
import { LoadingSpinner } from "@/components/ui/feedback";
import { useAuth } from "@/hooks/use-auth";

interface VerifyEmailViewProps {
  /** Present when the user arrived from a verification magic link. */
  token?: string;
}

/**
 * Two modes share the `/verify-email` route:
 * - With a `token` (magic link), auto-confirm the address and offer to continue.
 * - Without one, act as the gate for a signed-in but unverified user: tell them
 *   to check their inbox, and let them resend or sign out.
 */
export function VerifyEmailView(props: VerifyEmailViewProps): ReactElement {
  const { token } = props;
  return token ? <VerifyTokenView token={token} /> : <VerifyGateView />;
}

function VerifyTokenView(props: { token: string }): ReactElement {
  const { token } = props;
  const router = useRouter();
  const verifyEmail = useApiMutation<VerifyEmailResponse, VerifyEmailInput>((body) =>
    api.auth.email.verify.post(body),
  );
  const fired = useRef(false);

  useEffect(() => {
    // Fire once - the token is single-use, so a strict-mode double-invoke would
    // make the second call fail against an already-consumed token.
    if (fired.current) {
      return;
    }
    fired.current = true;
    verifyEmail.mutate({ token });
  }, [token, verifyEmail]);

  if (verifyEmail.isError) {
    return (
      <Stack spacing={2.5}>
        <Alert severity="error">{verifyEmail.error!.message}</Alert>
        <Typography variant="body2Muted">
          This link may have expired or already been used.
        </Typography>
        <Typography variant="body2Muted" sx={{ textAlign: "center" }}>
          <Link href="/login" color="primary">
            Back to sign in
          </Link>
        </Typography>
      </Stack>
    );
  }

  if (verifyEmail.isSuccess) {
    return (
      <Stack spacing={2.5}>
        <Alert severity="success">Your email is verified.</Alert>
        <Button
          onClick={() => router.push("/workspace")}
          variant="contained"
          size="large"
          fullWidth
        >
          Continue
        </Button>
      </Stack>
    );
  }

  return (
    <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", py: 3, gap: 2 }}>
      <LoadingSpinner size={20} py={0} />
      <Typography variant="body2Muted">Verifying your email…</Typography>
    </Box>
  );
}

function VerifyGateView(): ReactElement {
  const { user, logout } = useAuth();
  const resendVerification = useApiMutation<ResendVerificationResponse, void>(() =>
    api.auth.email.resend.post(),
  );

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
        disabled={resendVerification.isPending}
      >
        {resendVerification.isPending ? "Sending…" : "Resend email"}
      </Button>

      <Button variant="text" fullWidth onClick={() => logout.mutate()} disabled={logout.isPending}>
        Sign out
      </Button>
    </Stack>
  );
}
