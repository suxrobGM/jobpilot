"use client";

import type { ReactElement } from "react";
import { Alert, Stack, Typography } from "@mui/material";
import { PluginInstallCommands } from "@/components/features/install";
import { LoadingSpinner } from "@/components/ui/feedback";
import { BROWSER_BLOCKED_MESSAGE, useTerminalHealth } from "@/hooks/use-terminal-health";

/** Onboarding's "Connect agent" step: detects a running host, or shows compact install commands. */
export function AgentSetupStep(): ReactElement {
  const { health, status } = useTerminalHealth();

  if (health === "checking") {
    return (
      <Stack sx={{ alignItems: "center", py: 4 }}>
        <LoadingSpinner />
      </Stack>
    );
  }

  if (health === "reachable") {
    return (
      <Stack spacing={1.5}>
        <Alert severity="success">
          Agent detected{status?.hostVersion ? ` (v${status.hostVersion})` : ""} - you&apos;re all
          set. Finish to open your pilot, with the agent drawer ready.
        </Alert>
      </Stack>
    );
  }

  return (
    <Stack spacing={2}>
      <Typography variant="body2Muted">
        The agent runs on your machine and does the actual searching and applying. Add the JobPilot
        plugin to Claude Code or Codex, then run setup - it installs and starts everything.
      </Typography>
      {health === "blocked" && <Alert severity="warning">{BROWSER_BLOCKED_MESSAGE}</Alert>}
      {health === "degraded" && status?.detail && (
        <Alert severity="warning">
          A JobPilot host is running but broken: {status.detail} Re-run setup to reinstall.
        </Alert>
      )}
      <PluginInstallCommands />
      <Typography variant="body2Muted">
        You can do this anytime later. The agent button at the bottom of the sidebar opens the same
        instructions.
      </Typography>
    </Stack>
  );
}
