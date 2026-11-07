"use client";

import type { ReactElement } from "react";
import { Tab as MuiTab, Tabs } from "@mui/material";
import type { Route } from "next";
import { usePathname } from "next/navigation";

export interface Tab {
  label: string;
  href: Route;
}

interface TabStripProps {
  tabs: Tab[];
  ariaLabel: string;
}

export function TabStrip(props: TabStripProps): ReactElement {
  const { tabs, ariaLabel } = props;
  const pathname = usePathname();
  const active = tabs.some((tab) => tab.href === pathname) ? pathname : false;

  return (
    <Tabs value={active} variant="scrollable" aria-label={ariaLabel}>
      {tabs.map((tab) => (
        <MuiTab key={tab.href} value={tab.href} label={tab.label} href={tab.href} />
      ))}
    </Tabs>
  );
}
