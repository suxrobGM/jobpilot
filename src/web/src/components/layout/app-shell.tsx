"use client";

import type { PropsWithChildren, ReactElement } from "react";
import { Box } from "@mui/material";
import { AgentDock } from "@/components/features/agent-dock";
import { AgentProvider } from "@/providers/agent-provider";
import { Rail } from "./rail";

export function AppShell(props: PropsWithChildren): ReactElement {
  const { children } = props;
  return (
    <AgentProvider>
      <Box
        sx={(theme) => ({
          display: "flex",
          height: "100vh",
          minHeight: 0,
          backgroundColor: theme.palette.surfaces.base,
          color: theme.palette.text.primary,
        })}
      >
        <Rail />
        <Box
          component="main"
          sx={{ flex: 1, minWidth: 0, height: "100%", overflowY: "auto" }}
        >
          {children}
        </Box>
        <AgentDock />
      </Box>
    </AgentProvider>
  );
}
