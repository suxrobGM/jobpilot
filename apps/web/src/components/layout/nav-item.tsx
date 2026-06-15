"use client";

import type { ReactElement } from "react";
import { Box, Tooltip } from "@mui/material";
import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavItem as NavItemType } from "./shell-config";

interface NavItemProps {
  item: NavItemType;
}

export function NavItem(props: NavItemProps): ReactElement {
  const { item } = props;
  const pathname = usePathname();
  const Icon = item.icon;
  const targetPath = item.href.split("?")[0];
  const active = targetPath === "/" ? pathname === "/" : pathname.startsWith(targetPath);

  return (
    <Tooltip title={item.label} placement="right" arrow disableInteractive>
      <Box
        component={Link}
        href={item.href as Route}
        aria-label={item.label}
        aria-current={active ? "page" : undefined}
        sx={(theme) => ({
          position: "relative",
          width: 36,
          height: 36,
          display: "grid",
          placeItems: "center",
          borderRadius: theme.radii.sm,
          color: active ? theme.palette.text.primary : theme.palette.text.disabled,
          backgroundColor: active ? theme.palette.surfaces.elevated : "transparent",
          textDecoration: "none",
          transition: theme.motion.fast,
          "&:hover": {
            color: theme.palette.text.secondary,
            backgroundColor: active ? theme.palette.surfaces.elevated : theme.palette.surfaces.card,
          },
          "&::before": active
            ? {
                content: '""',
                position: "absolute",
                left: -10,
                top: 8,
                bottom: 8,
                width: 2,
                borderRadius: 2,
                background: theme.palette.accent.primary,
              }
            : undefined,
        })}
      >
        <Icon fontSize="md" />
      </Box>
    </Tooltip>
  );
}
