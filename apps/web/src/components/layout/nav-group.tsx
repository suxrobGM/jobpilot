"use client";

import type { ReactElement } from "react";
import { Stack, Typography } from "@mui/material";
import { NavItem } from "./nav-item";
import type { NavGroup as NavGroupType } from "./shell-config";

interface NavGroupProps {
  group: NavGroupType;
  collapsed: boolean;
}

export function NavGroup(props: NavGroupProps): ReactElement {
  const { group, collapsed } = props;
  return (
    <Stack
      spacing={0.25}
      role={group.label ? "group" : undefined}
      aria-label={group.label}
      sx={{ mt: group.label ? 2 : 0 }}
    >
      {group.label && !collapsed && (
        <Typography variant="overlineMuted" sx={{ px: 1, pb: 0.5 }}>
          {group.label}
        </Typography>
      )}
      {group.items.map((item) => (
        <NavItem key={item.href} item={item} collapsed={collapsed} />
      ))}
    </Stack>
  );
}
