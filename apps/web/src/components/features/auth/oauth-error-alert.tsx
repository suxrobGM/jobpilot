"use client";

import { type ReactNode, Suspense } from "react";
import { Alert } from "@mui/material";
import { useSearchParams } from "next/navigation";
import { resolveOauthReason } from "./oauth";

interface OAuthErrorAlertProps {
  /** A live submit error outranks the stale callback error still on the URL. */
  suppressed?: boolean;
}

/**
 * Reads `?oauth=error&reason=` itself, inside its own boundary, so the form around
 * it prerenders instead of waiting on a server render of the whole page.
 */
export function OAuthErrorAlert(props: OAuthErrorAlertProps): ReactNode {
  const { suppressed } = props;
  return (
    <Suspense fallback={null}>
      <OAuthError suppressed={suppressed} />
    </Suspense>
  );
}

function OAuthError(props: OAuthErrorAlertProps): ReactNode {
  const { suppressed } = props;
  const params = useSearchParams();

  if (suppressed || params.get("oauth") !== "error") {
    return null;
  }

  return (
    <Alert severity="error">{resolveOauthReason(params.get("reason")) ?? "Sign-in failed."}</Alert>
  );
}
