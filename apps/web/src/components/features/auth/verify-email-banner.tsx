"use client";

import { type ReactElement, useState } from "react";
import { Alert, Button } from "@mui/material";
import { api } from "@/api/client";
import { useApiMutation } from "@/api/use-api-mutation";
import { useSession } from "@/hooks/use-auth";

/** Non-blocking: only applying and networking are gated server-side until verified. */
export function VerifyEmailBanner(): ReactElement | null {
  const { user } = useSession();
  const [dismissed, setDismissed] = useState(false);
  const resend = useApiMutation(() => api.auth.email.verification.post(), {
    successMessage: "Verification email sent - check your inbox.",
  });

  if (dismissed || !user || user.emailVerified) {
    return null;
  }

  return (
    <Alert
      severity="warning"
      onClose={() => setDismissed(true)}
      sx={{ borderRadius: 0 }}
      action={
        <Button
          color="inherit"
          size="small"
          onClick={() => resend.mutate()}
          loading={resend.isPending}
        >
          Resend email
        </Button>
      }
    >
      Verify your email ({user.email}) to unlock applying and networking.
    </Alert>
  );
}
