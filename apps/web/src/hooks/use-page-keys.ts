"use client";

import { useEffect } from "react";

/** Typing in a field keeps its letters; only page-level keys fire shortcuts. */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

/** Single-key shortcuts (`j`, `Escape`, ...) while mounted; ignored in fields and with modifiers. */
export function usePageKeys(keys: Record<string, () => void>): void {
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (isTypingTarget(event.target) || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }
      keys[event.key]?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
}
