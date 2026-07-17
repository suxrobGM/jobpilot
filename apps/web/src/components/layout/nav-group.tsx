"use client";

import type { ReactElement } from "react";
import { Stack } from "@mui/material";
import { NavItem } from "./nav-item";
import type { NavGroup as NavGroupType } from "./shell-config";

interface NavGroupProps {
  group: NavGroupType;
}

export function NavGroup(props: NavGroupProps): ReactElement {
  const { group } = props;
  return (
    // No room for visible labels on the 56px rail - expose the group name to AT only.
    <Stack
      spacing={0.5}
      sx={{ alignItems: "center" }}
      role={group.label ? "group" : undefined}
      aria-label={group.label}
    >
      {group.items.map((item) => (
        <NavItem key={item.href} item={item} />
      ))}
    </Stack>
  );
}
