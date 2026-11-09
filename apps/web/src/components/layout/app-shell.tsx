"use client";

import { type PropsWithChildren, type ReactElement, useState } from "react";
import { Box } from "@mui/material";
import { AgentDrawer } from "@/components/features/agent/agent-drawer";
import { AgentWaitingBanner } from "@/components/features/agent/agent-waiting-banner";
import { PilotPairing } from "@/components/features/agent/pilot-pairing";
import { VerifyEmailBanner } from "@/components/features/auth";
import { PilotLive } from "@/components/features/pilot/pilot-live";
import { PipelineLive } from "@/components/features/pipeline";
import { type PageWidth, TopBarSlotsContext } from "@/components/ui/layout/top-bar-slots";
import { useIsDesktop } from "@/hooks/use-is-desktop";
import { MobileNav } from "./mobile-nav";
import { MOBILE_NAV_HEIGHT } from "./shell-config";
import { Sidebar } from "./sidebar";
import { TopBar } from "./top-bar";

export function AppShell(props: PropsWithChildren): ReactElement {
  const { children } = props;
  // Below md a bottom bar replaces the sidebar; the drawer still opens there for the agent's status.
  const isDesktop = useIsDesktop();
  const [titleSlot, setTitleSlot] = useState<HTMLElement | null>(null);
  const [actionsSlot, setActionsSlot] = useState<HTMLElement | null>(null);
  const [tabsSlot, setTabsSlot] = useState<HTMLElement | null>(null);
  const [pageWidth, setPageWidth] = useState<PageWidth | null>(null);

  return (
    <Box
      sx={(theme) => ({
        display: "flex",
        // dvh, not vh: phone vh counts the hidden address bar, so the shell overflows and the page scrolls.
        height: "100dvh",
        backgroundColor: theme.palette.surfaces.base,
      })}
    >
      {isDesktop && <Sidebar />}
      <Box
        component="main"
        sx={{
          // A column, so a full-height page (Pilot) can take what the top bar leaves.
          display: "flex",
          flexDirection: "column",
          flex: 1,
          minWidth: 0,
          height: "100%",
          overflowY: "auto",
          pb: isDesktop ? 0 : `${MOBILE_NAV_HEIGHT}px`,
        }}
      >
        <TopBar
          showMark={!isDesktop}
          pageWidth={pageWidth}
          titleRef={setTitleSlot}
          actionsRef={setActionsSlot}
          tabsRef={setTabsSlot}
        />
        <VerifyEmailBanner />
        <AgentWaitingBanner />
        <PilotLive />
        <PipelineLive />
        <PilotPairing />
        <TopBarSlotsContext
          value={{ title: titleSlot, actions: actionsSlot, tabs: tabsSlot, setPageWidth }}
        >
          {children}
        </TopBarSlotsContext>
      </Box>
      <AgentDrawer />
      {!isDesktop && <MobileNav />}
    </Box>
  );
}
