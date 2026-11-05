"use client";

import type { PropsWithChildren, ReactElement } from "react";
import { Box } from "@mui/material";
import { AgentDock } from "@/components/features/agent-dock/agent-dock";
import { VerifyEmailBanner } from "@/components/features/auth";
import { PilotLive } from "@/components/features/pilot/pilot-live";
import { useAgentAvailable } from "@/providers/agent-provider";
import { MobileNav } from "./mobile-nav";
import { Rail } from "./rail";
import { MOBILE_NAV_HEIGHT } from "./shell-config";

export function AppShell(props: PropsWithChildren): ReactElement {
  const { children } = props;
  // The agent terminal is desktop-only, so below md a bottom bar replaces the rail and dock.
  const isDesktop = useAgentAvailable();

  return (
    <Box
      sx={(theme) => ({
        display: "flex",
        height: "100vh",
        backgroundColor: theme.palette.surfaces.base,
      })}
    >
      {isDesktop && <Rail />}
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
        {children}
      </Box>
      {isDesktop ? <AgentDock /> : <MobileNav />}
    </Box>
  );
}
