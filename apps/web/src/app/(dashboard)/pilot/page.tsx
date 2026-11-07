import type { ReactElement } from "react";
import type { Metadata } from "next";
import { PilotHome } from "@/components/features/pilot";

export const metadata: Metadata = { title: "Pilot" };

/** Full-bleed, no PageShell: the queue column runs edge to edge under the top bar. */
export default function PilotPage(): ReactElement {
  return <PilotHome />;
}
