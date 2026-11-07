"use client";

import type { ReactElement } from "react";
import { Close, RestartAlt, StopCircle } from "@mui/icons-material";
import {
  Box,
  IconButton,
  MenuItem,
  Select,
  type SelectChangeEvent,
  Stack,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";
import { RunSteps } from "@/components/features/pilot/steps/run-steps";
import { TOP_BAR_HEIGHT } from "@/components/layout/shell-config";
import { TooltipIconButton } from "@/components/ui/buttons";
import { LoadingSpinner } from "@/components/ui/feedback";
import { BROWSER_BLOCKED_MESSAGE } from "@/hooks/use-terminal-health";
import { readAgentStorage } from "@/lib/terminal/agent-storage";
import { providerDisplayName, type TerminalProviderId } from "@/lib/terminal/client";
import { type AgentDrawerTab, useAgentDrawer } from "@/providers/agent-provider";
import { AgentInstallCard } from "./agent-install-card";
import { AgentOfflineCard } from "./agent-offline-card";
import { AgentOrb } from "./agent-orb";
import { TerminalPanel } from "./terminal-panel";
import { PendingRestartCard } from "./update/pending-restart-card";
import { AgentUpdateBanner } from "./update/update-banner";
import { useAgentActivity } from "./use-agent-activity";
import { useAgentHealth } from "./use-agent-health";

const PROVIDERS: TerminalProviderId[] = ["claude", "codex"];

export function AgentPanel(): ReactElement {
  const {
    closeDrawer,
    drawerTab,
    setDrawerTab,
    provider,
    switchProvider,
    restart,
    stop,
    terminalRevision,
  } = useAgentDrawer();
  const { health, status, pending, beginPending, unreachable } = useAgentHealth();
  const activity = useAgentActivity();
  const providerLabel = providerDisplayName(provider);
  const restarting = pending !== null && unreachable;

  const handleProviderChange = (event: SelectChangeEvent<string>): void => {
    void switchProvider(event.target.value === "codex" ? "codex" : "claude");
  };

  return (
    <Stack sx={{ width: "100%", height: "100%", minHeight: 0 }}>
      <Stack
        direction="row"
        sx={(theme) => ({
          alignItems: "center",
          paddingInline: theme.spacing(1.75),
          // Level with the top bar beside it.
          minHeight: TOP_BAR_HEIGHT.desktop,
          borderBottom: 1,
          borderColor: "divider",
        })}
      >
        <Stack direction="row" spacing={1.25} sx={{ alignItems: "center", flex: 1, minWidth: 0 }}>
          <AgentOrb state={restarting ? "connecting" : activity.orb} size="xxl" />
          <Stack sx={{ minWidth: 0 }}>
            <Typography variant="h6">Agent</Typography>
            <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", mt: 0.25 }}>
              {/* The labels are lowercase for the rail's "Agent · ready"; alone they start a sentence. */}
              <Typography
                variant="captionMuted"
                noWrap
                sx={{ display: "block", "&::first-letter": { textTransform: "uppercase" } }}
              >
                {restarting ? `${pending}…` : activity.label}
              </Typography>
              {status?.hostVersion && (
                <Typography variant="captionMuted">· v{status.hostVersion}</Typography>
              )}
            </Stack>
          </Stack>
        </Stack>
        <IconButton size="small" onClick={closeDrawer} aria-label="Close agent">
          <Close fontSize="md" />
        </IconButton>
      </Stack>
      <Tabs
        value={drawerTab}
        onChange={(_event, tab: AgentDrawerTab) => setDrawerTab(tab)}
        sx={{ borderBottom: 1, borderColor: "divider", minHeight: 0 }}
      >
        <Tab value="steps" label="Steps" />
        <Tab value="terminal" label="Terminal" />
      </Tabs>
      {drawerTab === "steps" && <RunSteps />}

      {/* Hidden rather than unmounted, so switching tabs keeps the terminal's connection. */}
      <Box
        sx={{
          display: drawerTab === "terminal" ? "flex" : "none",
          flexDirection: "column",
          flex: 1,
          minHeight: 0,
        }}
      >
        {health === "checking" && (
          <Stack sx={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <LoadingSpinner />
          </Stack>
        )}
        {health === "offline" &&
          (pending ? (
            <PendingRestartCard action={pending} />
          ) : (
            <AgentOfflineCard
              onStart={() => beginPending("starting")}
              // Live status while warm-offline; the persisted copy covers a cold reload (status is null then).
              canRelaunch={status?.canRelaunch ?? readAgentStorage()?.canRelaunch ?? false}
            />
          ))}
        {health === "uninstalled" && <AgentInstallCard />}
        {health === "blocked" && (
          <AgentInstallCard
            title="Allow local network access"
            description={`${BROWSER_BLOCKED_MESSAGE} Not installed yet? Run setup below first.`}
          />
        )}
        {health === "degraded" && (
          <AgentInstallCard
            title="Reinstall the JobPilot agent"
            description="The agent host is running but its plugin files are missing or corrupt. Re-run setup to refresh it, then recheck."
            detail={status?.detail}
          />
        )}
        {health === "reachable" && (
          <>
            {status && (
              <AgentUpdateBanner
                currentVersion={status.hostVersion}
                canUpdate={status.canUpdate}
                onUpdating={() => beginPending("updating")}
              />
            )}
            <Stack
              direction="row"
              spacing={0.75}
              sx={(theme) => ({
                alignItems: "center",
                paddingInline: theme.spacing(1.5),
                paddingBlock: theme.spacing(0.75),
                borderBottom: 1,
                borderColor: "divider",
              })}
            >
              <Select
                size="small"
                value={provider}
                onChange={handleProviderChange}
                inputProps={{ "aria-label": "Agent app" }}
                sx={{ minWidth: 120, mr: "auto", typography: "body2" }}
              >
                {PROVIDERS.map((id) => (
                  <MenuItem key={id} value={id}>
                    {providerDisplayName(id)}
                  </MenuItem>
                ))}
              </Select>
              <TooltipIconButton
                title={`Restart ${providerLabel}`}
                size="small"
                onClick={() => void restart()}
                aria-label="Restart"
              >
                <RestartAlt fontSize="sm" />
              </TooltipIconButton>
              <TooltipIconButton
                title="Stop agent (closes the terminal app)"
                size="small"
                onClick={() => {
                  beginPending("stopping");
                  // A stop that left the host up has no "went down" edge to clear the card.
                  void stop().then((down) => !down && beginPending(null));
                }}
                aria-label="Stop"
              >
                <StopCircle fontSize="sm" />
              </TooltipIconButton>
            </Stack>
            <TerminalPanel key={`${provider}-${terminalRevision}`} provider={provider} />
          </>
        )}
      </Box>
    </Stack>
  );
}
