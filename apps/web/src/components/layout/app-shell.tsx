"use client";

import type { PropsWithChildren, ReactElement } from "react";
import { Box } from "@mui/material";
import { AgentDock } from "@/components/features/agent-dock/agent-dock";
import { VerifyEmailBanner } from "@/components/features/auth";
import { useAgentAvailable } from "@/providers/agent-provider";
import { MobileNav } from "./mobile-nav";
import { Rail } from "./rail";
import { MOBILE_NAV_HEIGHT } from "./shell-config";

export function AppShell(props: PropsWithChildren): ReactElement {
  const { children } = props;
  // The local agent terminal only runs on desktop, so below md we drop the rail
  // and dock entirely and navigate via a bottom bar - a read-only, browse-only UI.
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
        {children}
      </Box>
      {isDesktop ? <AgentDock /> : <MobileNav />}
    </Box>
  );
}
