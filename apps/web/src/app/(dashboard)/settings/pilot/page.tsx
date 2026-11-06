import type { ReactElement } from "react";
import type { Metadata } from "next";
import { PilotSettingsForm } from "@/components/features/settings";

export const metadata: Metadata = { title: "Pilot settings" };

export default function PilotSettingsPage(): ReactElement {
  return <PilotSettingsForm />;
}
