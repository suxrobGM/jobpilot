import type { ReactElement } from "react";
import { type Tab, TabStrip } from "@/components/ui/navigation";

const TABS: Tab[] = [
  { label: "Resumes", href: "/resumes" },
  { label: "Cover letters", href: "/cover-letters" },
];

/** Resumes and the letters written from them, one rail item over two routes. */
export function ResumeTabs(): ReactElement {
  return <TabStrip tabs={TABS} ariaLabel="Resumes and cover letters" />;
}
