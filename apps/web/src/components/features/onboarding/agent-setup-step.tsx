"use client";

import type { ReactElement } from "react";
import { Alert, Button, Stack, Typography } from "@mui/material";
import { SetupOnComputerCard } from "@/components/features/agent/setup-on-computer-card";
import { StartAgentButton } from "@/components/features/agent/start-agent-button";
import {
  type AgentHealthState,
  useAgentHealth,
} from "@/components/features/agent/use-agent-health";
import { PluginInstallCommands } from "@/components/features/install";
import { LoadingSpinner } from "@/components/ui/feedback";
import { useIsDesktop } from "@/hooks/use-is-desktop";
import { BROWSER_BLOCKED_MESSAGE, canRelaunch } from "@/hooks/use-terminal-health";
import { useAgentConnected } from "@/providers/agent-provider";

interface AgentSetupStepProps {
  onContinue: () => void;
}

/** Onboarding's first step: the agent must run to read the resume next. */
export function AgentSetupStep(props: AgentSetupStepProps): ReactElement {
  const { onContinue } = props;
  const agent = useAgentHealth();
  const connected = useAgentConnected();
  const ready = agent.health === "reachable" || connected === true;

  return (
    <Stack spacing={3}>
      <AgentSetupBody agent={agent} ready={ready} />
      <Stack direction="row" sx={{ justifyContent: "flex-end", pt: 1 }}>
        <Button variant={ready ? "contained" : "text"} onClick={onContinue}>
          {ready ? "Next" : "Skip for now"}
        </Button>
      </Stack>
    </Stack>
  );
}

interface AgentSetupBodyProps {
  agent: AgentHealthState;
  ready: boolean;
}

function AgentSetupBody(props: AgentSetupBodyProps): ReactElement {
  const { agent, ready } = props;
  const { health, status, beginPending } = agent;
  const desktop = useIsDesktop();

  if (ready) {
    return (
      <Alert severity="success">
        Agent connected{status?.hostVersion ? ` (v${status.hostVersion})` : ""}. Next, it reads your
        resume and fills in your profile.
      </Alert>
    );
  }
  if (health === "checking") {
    return (
      <Stack sx={{ alignItems: "center", py: 4 }}>
        <LoadingSpinner />
      </Stack>
    );
  }
  if (!desktop) {
    return <SetupOnComputerCard />;
  }
  if (canRelaunch(agent)) {
    return (
      <Stack spacing={1.5} sx={{ alignItems: "flex-start" }}>
        <Typography variant="body2Muted">
          Your agent is installed but not running. Start it and this step picks it up.
        </Typography>
        <StartAgentButton onStart={() => beginPending("starting")} />
      </Stack>
    );
  }
  return (
    <Stack spacing={2}>
      <Typography variant="body2Muted">
        The agent runs on your machine: it reads your resume, then searches and applies. Add the
        JobPilot plugin to Claude Code or Codex and run setup; this step picks it up.
      </Typography>
      {health === "blocked" && <Alert severity="warning">{BROWSER_BLOCKED_MESSAGE}</Alert>}
      {health === "degraded" && status?.detail && (
        <Alert severity="warning">
          A JobPilot host is running but broken: {status.detail} Re-run setup to reinstall.
        </Alert>
      )}
      <PluginInstallCommands />
      <Typography variant="body2Muted">
        You can skip this and connect later from the sidebar&apos;s agent button.
      </Typography>
    </Stack>
  );
}
