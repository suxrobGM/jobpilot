"use client";

import type { ReactElement } from "react";
import { Box } from "@mui/material";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavBadge } from "./nav-badge";
import { RailLabel, railTile } from "./rail-tile";
import { isNavEntryActive, type NavItem as NavItemType } from "./shell-config";

interface NavItemProps {
  item: NavItemType;
}

export function NavItem(props: NavItemProps): ReactElement {
  const { item } = props;
  const pathname = usePathname();
  const Icon = item.icon;
  const active = isNavEntryActive(pathname, item);

  return (
    <Box
      component={Link}
      href={item.href}
      aria-current={active ? "page" : undefined}
      sx={railTile(active)}
    >
      <NavBadge badge={item.badge}>
        <Icon fontSize="lg" />
      </NavBadge>
      <RailLabel>{item.label}</RailLabel>
    </Box>
  );
}
