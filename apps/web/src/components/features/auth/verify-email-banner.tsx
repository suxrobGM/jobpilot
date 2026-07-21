"use client";

import { type ReactElement, useState } from "react";
import { Alert, Button } from "@mui/material";
import { api } from "@/api/client";
import { useApiMutation } from "@/api/hooks";
import type { ResendVerificationResponse } from "@/api/types";
import { useAuth } from "@/hooks/use-auth";

/**
 * Non-blocking nudge for signed-in, unverified users. Applying and networking are
 * gated server-side until the address is verified; everything else works.
 */
export function VerifyEmailBanner(): ReactElement | null {
  const { user } = useAuth();
  const [dismissed, setDismissed] = useState(false);
  const resend = useApiMutation<ResendVerificationResponse, void>(
    () => api.auth.email.resend.post(),
    { successMessage: "Verification email sent - check your inbox." },
  );

  if (dismissed || !user || user.emailVerified) {
    return null;
  }

  return (
    <Alert
      severity="warning"
      onClose={() => setDismissed(true)}
      sx={{ borderRadius: "0px" }}
      action={
        <Button
          color="inherit"
          size="small"
          onClick={() => resend.mutate()}
          disabled={resend.isPending}
        >
          {resend.isPending ? "Sending…" : "Resend email"}
        </Button>
      }
    >
      Verify your email ({user.email}) to unlock applying and networking.
    </Alert>
  );
}
