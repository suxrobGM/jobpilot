import type { ReactElement } from "react";
import type { Metadata } from "next";
import { OverviewTab } from "@/components/features/pilot";

export const metadata: Metadata = { title: "Pilot" };

export default function PilotPage(): ReactElement {
  return <OverviewTab />;
}
