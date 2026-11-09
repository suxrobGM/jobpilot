"use client";

import { createContext, useContext } from "react";

export type PageWidth = "md" | "lg" | "xl";

export interface TopBarSlots {
  title: HTMLElement | null;
  actions: HTMLElement | null;
  tabs: HTMLElement | null;
  /** Null on full-bleed pages. */
  setPageWidth: (width: PageWidth | null) => void;
}

export const TopBarSlotsContext = createContext<TopBarSlots>({
  title: null,
  actions: null,
  tabs: null,
  setPageWidth: () => {},
});

/** Where a page portals its title, actions and tabs into the app's top bar. */
export function useTopBarSlots(): TopBarSlots {
  return useContext(TopBarSlotsContext);
}

export const TOP_BAR_HEIGHT_VAR = "--top-bar-height";

export function belowTopBar(gap: string): string {
  return `calc(var(${TOP_BAR_HEIGHT_VAR}, 0px) + ${gap})`;
}
