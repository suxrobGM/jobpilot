"use client";

import { useEffect, useRef, useState } from "react";
import { type TerminalHealthState, useTerminalHealth } from "./use-terminal-health";

export type PendingAction = "updating" | "starting" | "stopping";

/** How long an expected restart may keep the calmer pending card up before the real offline card returns. */
const PENDING_RESTART_TIMEOUT_MS = 45_000;

export interface DockHealthState extends TerminalHealthState {
  /** Expected host state change in flight (dashboard-triggered update, Start agent, or Stop agent). */
  pending: PendingAction | null;
  beginPending: (action: PendingAction) => void;
  /** True while the host is not answering (checking, offline, or uninstalled). */
  unreachable: boolean;
}

/**
 * Terminal health plus the dock's expected-restart state: while an update or relaunch is pending the
 * poll runs fast, and the dock can show a transitional card instead of the offline one. Pending clears
 * once the host has gone down and answered again, or at the deadline.
 */
export function useDockHealth(): DockHealthState {
  const [pending, setPending] = useState<PendingAction | null>(null);
  const healthState = useTerminalHealth(pending !== null);
  const sawHostDown = useRef(false);

  const { health } = healthState;
  const unreachable = health !== "reachable" && health !== "degraded";

  const beginPending = (action: PendingAction): void => {
    sawHostDown.current = unreachable;
    setPending(action);
  };

  useEffect(() => {
    if (!pending) {
      return;
    }
    if (unreachable) {
      sawHostDown.current = true;
      return;
    }
    if (sawHostDown.current) {
      setPending(null);
    }
  }, [pending, unreachable]);

  useEffect(() => {
    if (!pending) {
      return;
    }
    const timer = setTimeout(() => setPending(null), PENDING_RESTART_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [pending]);

  return { ...healthState, pending, beginPending, unreachable };
}
