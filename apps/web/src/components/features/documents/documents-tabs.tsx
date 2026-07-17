import type { ReactElement } from "react";
import { type Tab, TabStrip } from "@/components/ui/navigation";

const TABS: Tab[] = [
  { label: "Resumes", href: "/documents/resumes" },
  { label: "Cover Letters", href: "/documents/cover-letters" },
];

export function DocumentsTabs(): ReactElement {
  return <TabStrip tabs={TABS} ariaLabel="Document types" />;
}
