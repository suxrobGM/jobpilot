"use client";

import { type ReactNode, useEffect, useRef } from "react";
import type { EmailConnectErrorReason } from "@jobpilot/contracts/email";
import { useSearchParams } from "next/navigation";
import { useToast } from "@/providers/toast-provider";

/** Copy for every contract slug (Record over the union so a new slug fails the build). */
const REASON_COPY: Record<EmailConnectErrorReason, string> = {
  access_denied: "Gmail connection was cancelled.",
  invalid_callback: "The Google sign-in expired. Try connecting again.",
  scope_not_granted: "Google didn't grant read access. Reconnect and allow every permission.",
  provider_error: "Google rejected the connection. Check your OAuth client, then try again.",
  unexpected: "Couldn't connect Gmail.",
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
    if (!status || fired.current) return;
    fired.current = true;
    if (status === "ok") {
      toast.success("Gmail connected");
    } else {
      toast.error(reasonCopy(reason));
    }
    window.history.replaceState(null, "", window.location.pathname);
  }, [status, reason, toast]);

  return null;
}
