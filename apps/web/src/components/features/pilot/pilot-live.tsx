"use client";

import type { ReactNode } from "react";
import { usePilotLive } from "./use-pilot-live";

/**
 * Renders nothing; exists so the pilot layout (a server component) can host
 * the shared pilot SSE subscription once, persisting across tab navigation.
 */
export function PilotLive(): ReactNode {
  usePilotLive();
  return null;
}
