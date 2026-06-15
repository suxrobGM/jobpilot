"use client";

import { useSyncExternalStore } from "react";

type Listener = () => void;

const listeners = new Set<Listener>();

function notify(): void {
  for (const listener of listeners) {
    listener();
  }
}

let crossTabListenerAttached = false;
function ensureCrossTabListener(): void {
  if (crossTabListenerAttached || typeof window === "undefined") {
    return;
  }
  crossTabListenerAttached = true;
  // Same-tab writes go through setValue → notify(); the storage event only
  // fires for OTHER tabs, so this keeps every tab in sync. Each instance
  // re-reads its own key, so notifying all on any change is harmless.
  window.addEventListener("storage", notify);
}

function subscribe(listener: Listener): () => void {
  ensureCrossTabListener();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function read(key: string): boolean | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? null : raw === "true";
  } catch {
    return null;
  }
}

/**
 * A boolean persisted to localStorage, kept in sync across hook instances in
 * the same tab and across tabs. SSR-safe via `useSyncExternalStore`'s server
 * snapshot.
 *
 * `fallback` is returned only when no value has been stored yet, so a caller
 * can derive a default (e.g. from a media query) while letting an explicit
 * user toggle win on subsequent reads.
 */
export function usePersistedBoolean(
  key: string,
  fallback: boolean,
): [boolean, (next: boolean) => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => {
      const stored = read(key);
      return stored === null ? fallback : stored;
    },
    () => fallback,
  );

  const setValue = (next: boolean): void => {
    try {
      window.localStorage.setItem(key, String(next));
    } catch {
      // Ignore storage failures (private mode, quota) — state still updates in memory.
    }
    notify();
  };

  return [value, setValue];
}
