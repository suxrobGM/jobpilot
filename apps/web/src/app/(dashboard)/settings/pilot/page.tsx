import type { ReactElement } from "react";
import type { Metadata } from "next";
import { InstructionsForm } from "@/components/features/pilot";

export const metadata: Metadata = { title: "Pilot settings" };

export default function PilotSettingsPage(): ReactElement {
  return <InstructionsForm variant="settings" />;
}
