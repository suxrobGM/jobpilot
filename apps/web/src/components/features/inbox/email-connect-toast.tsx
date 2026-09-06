"use client";

import { type ReactNode, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useToast } from "@/providers/notification-provider";

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
      toast.error(reason || "Couldn't connect Gmail");
    }
    window.history.replaceState(null, "", window.location.pathname);
  }, [status, reason, toast]);

  return null;
}
