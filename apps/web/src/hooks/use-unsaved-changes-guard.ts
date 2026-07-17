"use client";

import { useEffect } from "react";

/**
 * Shows the browser's leave-page prompt while `enabled`. Covers only full
 * unloads (close/reload/external nav) - the App Router has no supported way to
 * intercept client-side navigation, so pair it with an in-app dirty indicator.
 */
export function useUnsavedChangesGuard(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) {
      return;
    }
    const handler = (event: BeforeUnloadEvent): void => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [enabled]);
}
