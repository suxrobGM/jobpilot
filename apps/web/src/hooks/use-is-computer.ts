"use client";

import { useMediaQuery } from "@mui/material";

/** A mouse or trackpad: a device that can run the agent's local host, at any window width. */
export function useIsComputer(): boolean {
  return useMediaQuery("(pointer: fine)");
}
