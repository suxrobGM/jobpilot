"use client";

import type { ReactElement } from "react";
import type { ConfirmEmailChangeInput } from "@jobpilot/contracts/auth";
import { useSearchParams } from "next/navigation";
import { api } from "@/api/client";
import { useApiMutation } from "@/api/hooks";
import { MagicLinkView } from "./magic-link-view";

/** Lands from the email-change magic link; confirming revokes all sessions. */
export function ConfirmEmailChangeView(): ReactElement {
  const token = useSearchParams().get("token") ?? undefined;
  const confirmChange = useApiMutation(
    (body: ConfirmEmailChangeInput) => api.auth.email.change.confirm.post(body),
    { showErrorToast: false },
  );

  return (
    <MagicLinkView
      token={token}
      mutation={confirmChange}
      pendingText="Confirming your new email…"
      successText="Your email has been updated. Sign in with your new address."
      successLabel="Go to sign in"
      successHref="/login"
      errorHint="This link may have expired or already been used. You can request a new one from the Account security page."
    />
  );
}
