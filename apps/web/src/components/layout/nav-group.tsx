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
    <Stack spacing={0.5} sx={{ alignItems: "center" }}>
      {group.items.map((item) => (
        <NavItem key={item.href} item={item} />
      ))}
    </Stack>
  );
}
