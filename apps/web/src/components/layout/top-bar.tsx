"use client";

import type { ReactElement, Ref } from "react";
import { Box, Stack, Typography } from "@mui/material";
import NextLink from "next/link";
import { usePathname } from "next/navigation";
import { JobPilotMark } from "@/components/brand/jobpilot-mark";
import { AgentPill } from "@/components/features/agent/agent-pill";
import {
  ADMIN_NAV_ITEM,
  APP_TITLE,
  isNavEntryActive,
  NAV_GROUPS,
  SETTINGS_NAV_ITEM,
  TOP_BAR_HEIGHT,
} from "./shell-config";

const NAV_ITEMS = [
  ...NAV_GROUPS.flatMap((group) => group.items),
  SETTINGS_NAV_ITEM,
  ADMIN_NAV_ITEM,
];

interface TopBarProps {
  /** Without the sidebar, the bar carries the logo home link. */
  showMark: boolean;
  titleRef: Ref<HTMLElement>;
  actionsRef: Ref<HTMLElement>;
  tabsRef: Ref<HTMLElement>;
}

/** Page title, agent status, page actions and page tabs; a page's `PageHeader` fills the slots. */
export function TopBar(props: TopBarProps): ReactElement {
  const { showMark, titleRef, actionsRef, tabsRef } = props;
  const pathname = usePathname();
  const section = NAV_ITEMS.find((item) => isNavEntryActive(pathname, item));

  return (
    <Stack
      component="header"
      direction="row"
      sx={(theme) => ({
        position: "sticky",
        top: 0,
        // main is a flex column; an explicit minHeight would otherwise let the bar shrink over a wrapped actions row.
        flexShrink: 0,
        zIndex: theme.zIndex.appBar,
        flexWrap: "wrap",
        alignItems: "center",
        columnGap: 2,
        rowGap: 1,
        minHeight: { xs: TOP_BAR_HEIGHT.mobile, md: TOP_BAR_HEIGHT.desktop },
        paddingInline: { xs: 1.5, sm: 3 },
        paddingBlock: 1,
        borderBottom: 1,
        borderColor: "divider",
        backgroundColor: theme.palette.surfaces.base,
      })}
    >
      {showMark && (
        <Box
          component={NextLink}
          href="/pilot"
          aria-label={`${APP_TITLE} home`}
          sx={{ display: "flex" }}
        >
          <JobPilotMark size={28} />
        </Box>
      )}
      <Stack
        direction="row"
        sx={{ alignItems: "center", minWidth: 0, flex: { xs: 1, sm: "none" } }}
      >
        {/* A PageHeader portals here; the section name shows until one does. */}
        <Box ref={titleRef} data-slot sx={{ minWidth: 0, "&:empty": { display: "none" } }} />
        <Typography
          variant="h3"
          component="h1"
          noWrap
          sx={{ "[data-slot]:not(:empty) + &": { display: "none" } }}
        >
          {section?.label ?? APP_TITLE}
        </Typography>
      </Stack>
      <AgentPill />
      <Box
        ref={actionsRef}
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          ml: { sm: "auto" },
          // Phones: actions take their own scrollable row under the title.
          width: { xs: "100%", sm: "auto" },
          minWidth: 0,
          overflowX: { xs: "auto", sm: "visible" },
          "&:empty": { display: "none" },
        }}
      />
      {/* Tabs take the last row; the negative margin sets their underline on the bar's border. */}
      <Box
        ref={tabsRef}
        sx={{ width: "100%", minWidth: 0, mb: -1, "&:empty": { display: "none" } }}
      />
    </Stack>
  );
}
