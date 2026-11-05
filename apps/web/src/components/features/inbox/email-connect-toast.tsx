"use client";

import { type ReactNode, useEffect, useRef } from "react";
import type { EmailConnectErrorReason } from "@jobpilot/contracts/email";
import { useSearchParams } from "next/navigation";
import { useToast } from "@/providers/toast-provider";

/** Copy for every contract slug (Record over the union so a new slug fails the build). */
const REASON_COPY: Record<EmailConnectErrorReason, string> = {
  mailbox_access_denied:
    "Microsoft denied access to the selected mailbox. Check the signed-in user’s delegated mailbox permissions; your personal inbox was not connected instead.",
  access_denied: "Mailbox connection was cancelled.",
  invalid_callback: "The mailbox sign-in expired. Try connecting again.",
  scope_not_granted:
    "The mail provider did not grant read access. Reconnect and allow the required read permission.",
  provider_error:
    "The mail provider rejected the connection. Check your OAuth client, then try again.",
  unexpected: "Couldn't connect the mailbox.",
};

function reasonCopy(reason: string | null): string {
  return (reason && (REASON_COPY as Record<string, string>)[reason]) || REASON_COPY.unexpected;
}

/** One-time toast for the Gmail OAuth callback redirect (?emailConnect=ok|error); strips the query so refresh doesn't replay it. */
export function EmailConnectToast(): ReactNode {
  const params = useSearchParams();
  const status = params.get("emailConnect");
  const reason = params.get("reason");
  const toast = useToast();
  const fired = useRef(false);

  useEffect(() => {
    if (!status || fired.current) {
      return;
    }
    fired.current = true;
    if (status === "ok") {
      toast.success("Mailbox connected");
    } else {
      toast.error(reasonCopy(reason));
    }
    window.history.replaceState(null, "", window.location.pathname);
  }, [status, reason, toast]);

  return null;
}
