"use client";

import type { ReactElement } from "react";
import { belowTopBar } from "@/components/ui/layout/top-bar-slots";
import { SideNav, type SideNavGroup } from "@/components/ui/navigation";

const GROUPS: SideNavGroup[] = [
  {
    label: "You",
    links: [
      { label: "Profile", href: "/settings/profile" },
      { label: "Application answers", href: "/settings/answers" },
    ],
  },
  {
    label: "Pilot",
    links: [
      { label: "Behavior", href: "/settings/pilot" },
      { label: "Notifications", href: "/settings/notifications" },
    ],
  },
  {
    label: "Account",
    links: [
      { label: "Email", href: "/settings/email" },
      { label: "Security", href: "/settings/security" },
    ],
  },
  {
    label: "Advanced",
    links: [{ label: "Diagnostics", href: "/settings/diagnostics" }],
  },
];

export function SettingsNav(): ReactElement {
  return <SideNav label="Settings sections" groups={GROUPS} stickyTop={belowTopBar("24px")} />;
}
