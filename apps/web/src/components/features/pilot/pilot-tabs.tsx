import type { ReactElement } from "react";
import { type Tab, TabStrip } from "@/components/ui/navigation";

const TABS: Tab[] = [
  { label: "Overview", href: "/pilot" },
  { label: "Instructions", href: "/pilot/instructions" },
  { label: "Activity", href: "/pilot/activity" },
];

export function PilotTabs(): ReactElement {
  return <TabStrip tabs={TABS} ariaLabel="Pilot sections" />;
}
