import type { ReactElement } from "react";
import { Box } from "@mui/material";
import type { Route } from "next";
import { TabLink } from "./tab-link";

export interface Tab {
  label: string;
  href: Route;
}

interface TabStripProps {
  tabs: Tab[];
  ariaLabel: string;
}

/** Route tabs for `PageHeader tabs`; only the active-link highlight is client-side. */
export function TabStrip(props: TabStripProps): ReactElement {
  const { tabs, ariaLabel } = props;

  return (
    <Box
      component="nav"
      aria-label={ariaLabel}
      // overflow-x:auto computes overflow-y to auto too; sub-pixel rounding then adds a scrollbar.
      sx={{ display: "flex", overflowX: "auto", overflowY: "hidden" }}
    >
      {tabs.map((tab) => (
        <TabLink key={tab.href} href={tab.href} label={tab.label} />
      ))}
    </Box>
  );
}
