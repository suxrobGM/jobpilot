"use client";

import type { ReactElement, ReactNode } from "react";
import { Card, Tab, Tabs } from "@mui/material";
import { ListRow } from "@/components/ui/data";
import { CountLabel } from "@/components/ui/display";

interface MockTab {
  label: string;
  count: number;
}

interface MockTabsProps {
  tabs: MockTab[];
  active: string;
}

/** The page tabs under the app's top bar. */
export function MockTabs(props: MockTabsProps): ReactElement {
  const { tabs, active } = props;
  return (
    <Tabs value={active} variant="scrollable" sx={{ mb: 1.5 }}>
      {tabs.map((tab) => (
        <Tab
          key={tab.label}
          value={tab.label}
          label={<CountLabel label={tab.label} count={tab.count} />}
        />
      ))}
    </Tabs>
  );
}

interface MockRowProps {
  id: string;
  lead: ReactNode;
  title: string;
  meta: string;
  status: ReactNode;
}

interface MockListProps {
  rows: MockRowProps[];
}

/** A record list as the app draws one. */
export function MockList(props: MockListProps): ReactElement {
  const { rows } = props;
  return (
    <Card>
      {rows.map((row) => (
        <ListRow
          key={row.id}
          lead={row.lead}
          title={row.title}
          meta={row.meta}
          status={row.status}
        />
      ))}
    </Card>
  );
}
