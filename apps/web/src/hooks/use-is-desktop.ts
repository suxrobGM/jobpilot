"use client";

import { useMediaQuery } from "@mui/material";

/** md and up: the layout, and the agent's local host, assume a computer. */
export function useIsDesktop(): boolean {
  return useMediaQuery((theme) => theme.breakpoints.up("md"));
}
