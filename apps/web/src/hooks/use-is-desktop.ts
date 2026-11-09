"use client";

import { useMediaQuery } from "@mui/material";

/**
 * md and up: the rail-and-columns layout. Content density (list wrapping, the filter sheet)
 * switches at sm instead. False on the server and the hydration render, so prefer
 * `display: { xs, md }` wherever both layouts are cheap to render; `useIsComputer` is the
 * test for "can host the agent".
 */
export function useIsDesktop(): boolean {
  return useMediaQuery((theme) => theme.breakpoints.up("md"));
}
