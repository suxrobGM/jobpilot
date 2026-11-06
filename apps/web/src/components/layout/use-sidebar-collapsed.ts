"use client";

import { useSyncExternalStore } from "react";
import { ExternalStore } from "@/lib/external-store";
import { readLocalStorage, writeLocalStorage } from "@/utils/local-storage";

const STORAGE_KEY = "jobpilot:sidebar-collapsed";

const read = (): boolean => readLocalStorage<boolean>(STORAGE_KEY) === true;

const store = new ExternalStore(false, () => {
  const sync = () => store.set(read());
  sync();
  window.addEventListener("storage", sync);
  return () => window.removeEventListener("storage", sync);
});

/** Whether the sidebar shows only icons; kept per browser. */
export function useSidebarCollapsed(): [boolean, (collapsed: boolean) => void] {
  // The server snapshot renders expanded, matching a first visit.
  const collapsed = useSyncExternalStore(store.subscribe, store.get, () => false);
  const setCollapsed = (next: boolean): void => {
    writeLocalStorage(STORAGE_KEY, next);
    store.set(next);
  };
  return [collapsed, setCollapsed];
}
