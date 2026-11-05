import type { ReactElement, ReactNode } from "react";
import { Alert } from "@mui/material";

interface MailboxReauthAlertProps {
  /** Reconnect affordance for surfaces that don't already show one. */
  action?: ReactNode;
}

/** Shown when `accountStatus.needsReauth` is set - the mailbox's OAuth grant was rejected. */
export function MailboxReauthAlert(props: MailboxReauthAlertProps): ReactElement {
  const { action } = props;
  return (
    <Alert severity="error" action={action}>
      Google rejected this mailbox&apos;s access grant, so mail sync, verification codes, and
      sending are paused. Reconnect to sign in again.
    </Alert>
  );
}
