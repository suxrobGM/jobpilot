"use client";

import { useEffect } from "react";

/** Full unloads only: the App Router can't intercept client navigation; pair with a dirty cue. */
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
