"use client";

import { type PropsWithChildren, type ReactElement, useState } from "react";
import { Box } from "@mui/material";
import { AgentDrawer } from "@/components/features/agent/agent-drawer";
import { PilotPairing } from "@/components/features/agent/pilot-pairing";
import { VerifyEmailBanner } from "@/components/features/auth";
import { PilotLive } from "@/components/features/pilot/pilot-live";
import { PipelineLive } from "@/components/features/pipeline";
import { TopBarSlotsContext } from "@/components/ui/layout/top-bar-slots";
import { useAgentAvailable } from "@/providers/agent-provider";
import { MobileNav } from "./mobile-nav";
import { MOBILE_NAV_HEIGHT } from "./shell-config";
import { Sidebar } from "./sidebar";
import { TopBar } from "./top-bar";

export function AppShell(props: PropsWithChildren): ReactElement {
  const { children } = props;
  // Below md a bottom bar replaces the sidebar; the drawer still opens there for the agent's status.
  const isDesktop = useAgentAvailable();
  const [titleSlot, setTitleSlot] = useState<HTMLElement | null>(null);
  const [actionsSlot, setActionsSlot] = useState<HTMLElement | null>(null);

  return (
    <Box
      sx={(theme) => ({
        display: "flex",
        height: "100vh",
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
        <TopBar showMark={!isDesktop} titleRef={setTitleSlot} actionsRef={setActionsSlot} />
        <VerifyEmailBanner />
        <PilotLive />
        <PipelineLive />
        <PilotPairing />
        <TopBarSlotsContext value={{ title: titleSlot, actions: actionsSlot }}>
          {children}
        </TopBarSlotsContext>
      </Box>
      <AgentDrawer />
      {!isDesktop && <MobileNav />}
    </Box>
  );
}
