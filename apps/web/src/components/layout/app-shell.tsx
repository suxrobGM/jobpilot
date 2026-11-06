"use client";

import type { PropsWithChildren, ReactElement } from "react";
import { Box } from "@mui/material";
import { AgentDrawer } from "@/components/features/agent/agent-drawer";
import { PilotPairing } from "@/components/features/agent/pilot-pairing";
import { VerifyEmailBanner } from "@/components/features/auth";
import { PilotLive } from "@/components/features/pilot/pilot-live";
import { PipelineLive } from "@/components/features/pipeline";
import { useAgentAvailable } from "@/providers/agent-provider";
import { MobileNav } from "./mobile-nav";
import { MOBILE_NAV_HEIGHT } from "./shell-config";
import { Sidebar } from "./sidebar";

export function AppShell(props: PropsWithChildren): ReactElement {
  const { children } = props;
  // Below md a bottom bar replaces the sidebar; the drawer still opens there for the agent's status.
  const isDesktop = useAgentAvailable();

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
          flex: 1,
          height: "100%",
          overflowY: "auto",
          pb: isDesktop ? 0 : `${MOBILE_NAV_HEIGHT}px`,
        }}
      >
        <VerifyEmailBanner />
        <PilotLive />
        <PipelineLive />
        <PilotPairing />
        {children}
      </Box>
      <AgentDrawer />
      {!isDesktop && <MobileNav />}
    </Box>
  );
}
