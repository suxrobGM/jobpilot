"use client";

import type { ReactElement } from "react";
import { Check, Close, ExpandMore, RestartAlt, StopCircle } from "@mui/icons-material";
import { Box, Button, IconButton, Stack, Tab, Tabs, Typography } from "@mui/material";
import { RunSteps } from "@/components/features/pilot/steps/run-steps";
import { TOP_BAR_HEIGHT } from "@/components/layout/shell-config";
import { TooltipIconButton } from "@/components/ui/buttons";
import { LoadingSpinner } from "@/components/ui/feedback";
import { DropdownMenu } from "@/components/ui/navigation";
import { useIsComputer } from "@/hooks/use-is-computer";
import { BROWSER_BLOCKED_MESSAGE, canRelaunch } from "@/hooks/use-terminal-health";
import { providerDisplayName, type TerminalProviderId } from "@/lib/terminal/client";
import { type AgentDrawerTab, useAgentDrawer } from "@/providers/agent-provider";
import { AgentInstallCard } from "./agent-install-card";
import { AgentOfflineCard } from "./agent-offline-card";
import { AgentOrb } from "./agent-orb";
import { AgentRemoteCard } from "./agent-remote-card";
import { SetupOnComputerCard } from "./setup-on-computer-card";
import { TerminalPanel } from "./terminal-panel";
import { PendingRestartCard } from "./update/pending-restart-card";
import { AgentUpdateBanner } from "./update/update-banner";
import { useAgentActivity } from "./use-agent-activity";
import { type AgentHealthState, useAgentHealth } from "./use-agent-health";

const PROVIDERS: TerminalProviderId[] = ["claude", "codex"];

export function AgentPanel(): ReactElement {
  const { closeDrawer, drawerTab, setDrawerTab, provider, switchProvider, restart, stop } =
    useAgentDrawer();
  const agent = useAgentHealth();
  const { health, status, pending, beginPending, unreachable } = agent;
  const activity = useAgentActivity();
  const providerLabel = providerDisplayName(provider);
  const restarting = pending !== null && unreachable;

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
          <AgentOrb state={restarting ? "connecting" : activity.orb} size="xl" />
          <Typography variant="h4" component="h2">
            Agent
          </Typography>
          {/* The labels are lowercase for the rail's "Agent · ready"; alone they start a sentence. */}
          <Typography
            variant="captionMuted"
            noWrap
            sx={{
              display: "block",
              minWidth: 0,
              "&::first-letter": { textTransform: "uppercase" },
            }}
          >
            {restarting ? `${pending}…` : activity.label}
            {status?.hostVersion && ` · v${status.hostVersion}`}
          </Typography>
        </Stack>
        <IconButton size="small" onClick={closeDrawer} aria-label="Close agent">
          <Close fontSize="md" />
        </IconButton>
      </Stack>
      {/* The terminal's controls share the tab row, so the terminal keeps the height. */}
      <Stack
        direction="row"
        spacing={0.5}
        sx={{ alignItems: "center", pr: 1, borderBottom: 1, borderColor: "divider" }}
      >
        <Tabs
          value={drawerTab}
          onChange={(_event, tab: AgentDrawerTab) => setDrawerTab(tab)}
          sx={{ flex: 1, minHeight: 0 }}
        >
          <Tab value="steps" label="Steps" />
          <Tab value="terminal" label="Terminal" />
        </Tabs>
        {drawerTab === "terminal" && health === "reachable" && (
          <>
            <DropdownMenu
              minWidth={160}
              trigger={({ onOpen }) => (
                <Button
                  size="small"
                  color="inherit"
                  endIcon={<ExpandMore fontSize="sm" />}
                  onClick={onOpen}
                  aria-label={`Agent app: ${providerLabel}`}
                >
                  {providerLabel}
                </Button>
              )}
              items={PROVIDERS.map((id) => ({
                kind: "item" as const,
                key: id,
                label: providerDisplayName(id),
                trailing: id === provider ? <Check fontSize="sm" /> : null,
                onClick: () => void switchProvider(id),
              }))}
            />
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
          </>
        )}
      </Stack>
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
        <TerminalTabBody agent={agent} remote={activity.remote} />
      </Box>
    </Stack>
  );
}

interface TerminalTabBodyProps {
  agent: AgentHealthState;
  remote: boolean;
}

function TerminalTabBody(props: TerminalTabBodyProps): ReactElement {
  const { agent, remote } = props;
  const { health, status, pending, beginPending } = agent;
  const { provider, terminalRevision } = useAgentDrawer();
  const computer = useIsComputer();

  if (health === "reachable") {
    return (
      <>
        {status && (
          <AgentUpdateBanner
            currentVersion={status.hostVersion}
            canUpdate={status.canUpdate}
            onUpdating={() => beginPending("updating")}
          />
        )}
        <TerminalPanel key={`${provider}-${terminalRevision}`} provider={provider} />
      </>
    );
  }
  if (health === "degraded") {
    return (
      <AgentInstallCard
        title="Reinstall the JobPilot agent"
        description="The agent host is running but its plugin files are missing or corrupt. Re-run setup to refresh it, then recheck."
        detail={status?.detail}
      />
    );
  }
  if (health === "offline") {
    if (pending) {
      return <PendingRestartCard action={pending} />;
    }
    return (
      <AgentOfflineCard onStart={() => beginPending("starting")} canRelaunch={canRelaunch(agent)} />
    );
  }
  if (remote) {
    return <AgentRemoteCard />;
  }
  if (health === "checking") {
    return (
      <Stack sx={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <LoadingSpinner />
      </Stack>
    );
  }
  // A phone has no host of its own to install or unblock.
  if (!computer) {
    return <SetupOnComputerCard />;
  }
  if (health === "blocked") {
    return (
      <AgentInstallCard
        title="Allow local network access"
        description={`${BROWSER_BLOCKED_MESSAGE} Not installed yet? Run setup below first.`}
      />
    );
  }
  return <AgentInstallCard />;
}
