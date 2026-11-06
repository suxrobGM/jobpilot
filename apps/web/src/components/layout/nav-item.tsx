"use client";

import type { ReactElement } from "react";
import { Box, Tooltip, Typography } from "@mui/material";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavBadge, NavCount } from "./nav-badge";
import { isNavEntryActive, type NavItem as NavItemType } from "./shell-config";

interface NavItemProps {
  item: NavItemType;
  collapsed: boolean;
}

export function NavItem(props: NavItemProps): ReactElement {
  const { item, collapsed } = props;
  const pathname = usePathname();
  const Icon = item.icon;
  const active = isNavEntryActive(pathname, item);

  return (
    <Tooltip title={collapsed ? item.label : ""} placement="right" arrow>
      <Box
        component={Link}
        href={item.href}
        aria-label={collapsed ? item.label : undefined}
        aria-current={active ? "page" : undefined}
        sx={(theme) => ({
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          height: 36,
          paddingInline: 1,
          borderRadius: theme.radii.sm,
          color: active ? "text.primary" : "text.secondary",
          backgroundColor: active ? theme.palette.surfaces.elevated : "transparent",
          textDecoration: "none",
          transition: theme.motion.fast,
          "&:hover": {
            color: "text.primary",
            backgroundColor: active ? theme.palette.surfaces.elevated : theme.palette.surfaces.card,
          },
          "&:focus-visible": { outline: "none", boxShadow: theme.shadows_custom.focus },
        })}
      >
        <NavBadge badge={collapsed ? item.badge : undefined} variant="dot">
          <Icon fontSize="md" sx={{ color: active ? "accent.primary" : undefined }} />
        </NavBadge>
        {!collapsed && (
          <>
            <Typography variant="body2" noWrap>
              {item.label}
            </Typography>
            <NavCount badge={item.badge} />
          </>
        )}
      </Box>
    </Tooltip>
  );
}
