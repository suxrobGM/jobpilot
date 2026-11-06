"use client";

import { useSyncExternalStore } from "react";
import { readLocalStorage, writeLocalStorage } from "@/utils/local-storage";

const STORAGE_KEY = "jobpilot:sidebar-collapsed";
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

const read = (): boolean => readLocalStorage<boolean>(STORAGE_KEY) === true;

/** Whether the sidebar shows only icons; kept per browser. */
export function useSidebarCollapsed(): [boolean, (collapsed: boolean) => void] {
  // The server snapshot renders expanded, matching a first visit.
  const collapsed = useSyncExternalStore(subscribe, read, () => false);
  const setCollapsed = (next: boolean): void => {
    writeLocalStorage(STORAGE_KEY, next);
    for (const listener of listeners) listener();
  };
  return [collapsed, setCollapsed];
}
