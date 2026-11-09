"use client";

import { type ReactElement, Suspense } from "react";
import { Box, Divider, Stack } from "@mui/material";
import NextLink from "next/link";
import { JobPilotMark } from "@/components/brand/jobpilot-mark";
import { AgentButton } from "@/components/features/agent/agent-button";
import { AccountMenu } from "./account-menu";
import { NavGroup } from "./nav-group";
import { NavItem } from "./nav-item";
import { APP_TITLE, RAIL_WIDTH, SETTINGS_NAV_ITEM } from "./shell-config";
import { useNavGroups } from "./use-nav-groups";

/** A fixed rail from md: icons with short labels, so every section stays readable in little width. */
export function Sidebar(): ReactElement {
  const groups = useNavGroups();

  return (
    <Stack
      component="aside"
      aria-label={APP_TITLE}
      spacing={1}
      sx={{
        display: { xs: "none", md: "flex" },
        width: RAIL_WIDTH,
        flexShrink: 0,
        height: "100%",
        paddingInline: 1,
        paddingBlock: 1.5,
        borderRight: 1,
        borderColor: "divider",
        backgroundColor: "background.default",
      }}
    >
      <Box
        component={NextLink}
        href="/pilot"
        aria-label={`${APP_TITLE} home`}
        sx={(theme) => ({
          display: "flex",
          alignSelf: "center",
          mb: 1,
          borderRadius: theme.radii.md,
          "&:focus-visible": { outline: "none", boxShadow: theme.shadows_custom.focus },
        })}
      >
        <JobPilotMark size={32} />
      </Box>
      <Stack
        component="nav"
        spacing={0.5}
        sx={{ flex: 1, overflowY: "auto", scrollbarWidth: "none" }}
      >
        <Suspense fallback={null}>
          {groups.map((group) => (
            <NavGroup key={group.label ?? "main"} group={group} />
          ))}
        </Suspense>
      </Stack>
      <Divider sx={{ mx: 1.5 }} />
      <Stack spacing={0.5}>
        <AgentButton />
        <Suspense fallback={null}>
          <NavItem item={SETTINGS_NAV_ITEM} />
        </Suspense>
        <AccountMenu />
      </Stack>
    </Stack>
  );
}
