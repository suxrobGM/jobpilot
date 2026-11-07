"use client";

import { createContext, useContext } from "react";

export interface TopBarSlots {
  title: HTMLElement | null;
  actions: HTMLElement | null;
  tabs: HTMLElement | null;
}

export const TopBarSlotsContext = createContext<TopBarSlots>({
  title: null,
  actions: null,
  tabs: null,
});

/** Where a page portals its title, actions and tabs into the app's top bar. */
export function useTopBarSlots(): TopBarSlots {
  return useContext(TopBarSlotsContext);
}
