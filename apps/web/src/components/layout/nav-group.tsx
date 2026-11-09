"use client";

import type { ReactElement } from "react";
import { Divider, Stack } from "@mui/material";
import { NavItem } from "./nav-item";
import type { NavGroup as NavGroupType } from "./shell-config";

interface NavGroupProps {
  group: NavGroupType;
}

/** A labelled group (Channels) is set off by a rule; the rail has no room for its heading. */
export function NavGroup(props: NavGroupProps): ReactElement {
  const { group } = props;
  return (
    <Stack spacing={0.5} role={group.label ? "group" : undefined} aria-label={group.label}>
      {group.label && <Divider sx={{ mx: 1.5, my: 0.5 }} />}
      {group.items.map((item) => (
        <NavItem key={item.href} item={item} />
      ))}
    </Stack>
  );
}
