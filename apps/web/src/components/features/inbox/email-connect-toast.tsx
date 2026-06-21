"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useToast } from "@/providers/notification-provider";

interface EmailConnectToastProps {
  status?: string;
  reason?: string;
}

/** One-time toast for the Gmail OAuth callback redirect (?emailConnect=ok|error); strips the query so refresh doesn't replay it. */
export function EmailConnectToast(props: EmailConnectToastProps): ReactNode {
  const { status, reason } = props;
  const toast = useToast();
  const fired = useRef(false);

  useEffect(() => {
    if (!status || fired.current) return;
    fired.current = true;
    if (status === "ok") {
      toast.success("Gmail connected");
    } else {
      toast.error(reason || "Couldn't connect Gmail");
    }
    window.history.replaceState(null, "", window.location.pathname);
  }, [status, reason, toast]);

  return null;
}
