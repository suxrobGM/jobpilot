"use client";

import type { ReactElement } from "react";
import { Box, Tooltip } from "@mui/material";
import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { QuestionBadge } from "@/components/features/pilot/attention/question-badge";
import { isNavEntryActive, type NavItem as NavItemType } from "./shell-config";

interface NavItemProps {
  item: NavItemType;
}

export function NavItem(props: NavItemProps): ReactElement {
  const { item } = props;
  const pathname = usePathname();
  const Icon = item.icon;
  const active = isNavEntryActive(pathname, item);
  const icon = <Icon fontSize="md" />;

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
          color: active ? "text.primary" : "text.disabled",
          backgroundColor: active ? theme.palette.surfaces.elevated : "transparent",
          textDecoration: "none",
          transition: theme.motion.fast,
          "&:hover": {
            color: "text.secondary",
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
                borderRadius: `${theme.radii.xs}px`,
                background: theme.palette.accent.primary,
              }
            : undefined,
        })}
      >
        {item.badge === "questions" ? <QuestionBadge>{icon}</QuestionBadge> : icon}
      </Box>
    </Tooltip>
  );
}
