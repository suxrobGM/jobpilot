"use client";

import { type ReactElement, Suspense } from "react";
import { KeyboardDoubleArrowLeft, KeyboardDoubleArrowRight } from "@mui/icons-material";
import { Box, Divider, Stack, Typography } from "@mui/material";
import NextLink from "next/link";
import { JobPilotMark } from "@/components/brand/jobpilot-mark";
import { AgentButton } from "@/components/features/agent/agent-button";
import { TooltipIconButton } from "@/components/ui/buttons";
import { AccountMenu } from "./account-menu";
import { NavGroup } from "./nav-group";
import { NavItem } from "./nav-item";
import {
  APP_TITLE,
  SETTINGS_NAV_ITEM,
  SIDEBAR_COLLAPSED_WIDTH,
  SIDEBAR_WIDTH,
} from "./shell-config";
import { useNavGroups } from "./use-nav-groups";
import { useSidebarCollapsed } from "./use-sidebar-collapsed";

export function Sidebar(): ReactElement {
  const [collapsed, setCollapsed] = useSidebarCollapsed();
  const groups = useNavGroups();

  return (
    <Stack
      component="aside"
      aria-label={APP_TITLE}
      sx={(theme) => ({
        width: collapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH,
        flexShrink: 0,
        height: "100%",
        padding: 1,
        gap: 1,
        borderRight: 1,
        borderColor: "divider",
        backgroundColor: theme.palette.surfaces.base,
        overflowX: "hidden",
        transition: theme.motion.standard,
      })}
    >
      <Stack
        direction={collapsed ? "column" : "row"}
        sx={{ alignItems: "center", gap: 1, minHeight: 40, pl: collapsed ? 0 : 0.5 }}
      >
        <Box
          component={NextLink}
          href="/pilot"
          aria-label={`${APP_TITLE} home`}
          sx={(theme) => ({
            display: "flex",
            alignItems: "center",
            gap: 1,
            color: "text.primary",
            textDecoration: "none",
            borderRadius: theme.radii.sm,
            "&:focus-visible": { outline: "none", boxShadow: theme.shadows_custom.focus },
          })}
        >
          <JobPilotMark size={28} />
          {!collapsed && <Typography variant="body1Strong">{APP_TITLE}</Typography>}
        </Box>
        <TooltipIconButton
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          placement="right"
          size="small"
          onClick={() => setCollapsed(!collapsed)}
          sx={{ color: "text.secondary", ml: collapsed ? 0 : "auto" }}
        >
          {collapsed ? (
            <KeyboardDoubleArrowRight fontSize="md" />
          ) : (
            <KeyboardDoubleArrowLeft fontSize="md" />
          )}
        </TooltipIconButton>
      </Stack>
      <Box component="nav" sx={{ flex: 1, overflowY: "auto" }}>
        <Suspense fallback={null}>
          {groups.map((group) => (
            <NavGroup key={group.label ?? "main"} group={group} collapsed={collapsed} />
          ))}
        </Suspense>
      </Box>
      <Divider />
      <Stack spacing={0.25}>
        <AgentButton collapsed={collapsed} />
        <Suspense fallback={null}>
          <NavItem item={SETTINGS_NAV_ITEM} collapsed={collapsed} />
        </Suspense>
        <AccountMenu collapsed={collapsed} />
      </Stack>
    </Stack>
  );
}
