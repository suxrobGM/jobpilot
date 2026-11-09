"use client";

import { type ReactElement, type Ref, useEffect, useRef } from "react";
import { Box, Stack, Typography } from "@mui/material";
import { usePathname } from "next/navigation";
import { AgentPill } from "@/components/features/agent/agent-pill";
import { type PageWidth, TOP_BAR_HEIGHT_VAR } from "@/components/ui/layout/top-bar-slots";
import {
  ADMIN_NAV_ITEM,
  APP_TITLE,
  isNavEntryActive,
  NAV_GROUPS,
  SETTINGS_NAV_ITEM,
  TOP_BAR_HEIGHT,
} from "./shell-config";

/** Tabs and wrapped actions change the height that sticky content clears. */
function useHeightVar() {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const bar = ref.current;
    const scroller = bar?.parentElement;
    if (!bar || !scroller) {
      return;
    }
    const observer = new ResizeObserver(() =>
      scroller.style.setProperty(TOP_BAR_HEIGHT_VAR, `${bar.offsetHeight}px`),
    );
    observer.observe(bar);
    return () => observer.disconnect();
  }, []);
  return ref;
}

const NAV_ITEMS = [
  ...NAV_GROUPS.flatMap((group) => group.items),
  SETTINGS_NAV_ITEM,
  ADMIN_NAV_ITEM,
];

interface TopBarProps {
  /** Without the rail (phones), the bar carries the agent's status. */
  showAgentPill: boolean;
  /** Null on full-bleed pages. */
  pageWidth: PageWidth | null;
  titleRef: Ref<HTMLElement>;
  actionsRef: Ref<HTMLElement>;
  tabsRef: Ref<HTMLElement>;
}

/** Page title, page actions and page tabs; a page's `PageHeader` fills the slots. */
export function TopBar(props: TopBarProps): ReactElement {
  const { showAgentPill, pageWidth, titleRef, actionsRef, tabsRef } = props;
  const pathname = usePathname();
  const heightRef = useHeightVar();
  const section = NAV_ITEMS.find((item) => isNavEntryActive(pathname, item));

  return (
    <Box
      ref={heightRef}
      component="header"
      sx={(theme) => ({
        position: "sticky",
        top: 0,
        // main is a flex column; it would otherwise shrink the bar over a wrapped actions row.
        flexShrink: 0,
        zIndex: theme.zIndex.appBar,
        borderBottom: 1,
        borderColor: "divider",
        backgroundColor: theme.palette.surfaces.base,
      })}
    >
      <Stack
        direction="row"
        sx={(theme) => ({
          flexWrap: "wrap",
          alignItems: "center",
          columnGap: { xs: 1, sm: 2 },
          rowGap: 1,
          minHeight: { xs: TOP_BAR_HEIGHT.mobile, md: TOP_BAR_HEIGHT.desktop },
          paddingInline: { xs: 1.5, sm: 3 },
          paddingBlock: 1,
          marginInline: "auto",
          maxWidth: pageWidth ? theme.breakpoints.values[pageWidth] : "none",
        })}
      >
        <Stack direction="row" sx={{ alignItems: "center", minWidth: 0, flex: 1 }}>
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
        <Box
          ref={actionsRef}
          sx={(theme) => ({
            display: "flex",
            alignItems: "center",
            gap: { xs: 0.5, sm: 1 },
            minWidth: 0,
            overflowX: "auto",
            "&:empty": { display: "none" },
            // Phones: buttons with an icon drop their label, so title and actions share one row.
            // font-size 0 keeps the label as the accessible name; the icon sizes itself.
            [theme.breakpoints.down("sm")]: {
              "& .MuiButton-root:has(.MuiButton-startIcon)": {
                fontSize: 0,
                minWidth: 0,
                paddingInline: 1,
                "& .MuiButton-startIcon": { margin: 0 },
              },
            },
          })}
        />
        {showAgentPill && <AgentPill />}
        {/* Tabs take the last row; the negative margin sets their underline on the bar's border. */}
        <Box
          ref={tabsRef}
          sx={{
            width: "100%",
            minWidth: 0,
            mb: -1,
            "&:empty": { display: "none" },
            "& .MuiTabs-root": { borderBottom: 0 },
            "& .MuiTabs-root, & .MuiTab-root": { minHeight: { xs: 40, sm: 48 } },
            "& .MuiTab-root": { paddingBlock: { xs: 1, sm: 1.5 } },
          }}
        />
      </Stack>
    </Box>
  );
}
