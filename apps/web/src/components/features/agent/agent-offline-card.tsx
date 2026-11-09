"use client";

import type { ReactElement } from "react";
import { Stack, Typography } from "@mui/material";
import { CopyField } from "@/components/ui/display";
import { formatSkillCommand, providerDisplayName } from "@/lib/terminal/client";
import { useAgentDrawer } from "@/providers/agent-provider";
import { AgentCard } from "./agent-card";
import { RecheckButton } from "./recheck-button";
import { StartAgentButton } from "./start-agent-button";

interface AgentOfflineCardProps {
  onStart: () => void;
  /** Whether the host registered the jobpilot:// scheme, so the browser can relaunch it. */
  canRelaunch: boolean;
}

/** A host once connected from this browser but isn't answering now: installed, just stopped. */
export function AgentOfflineCard(props: AgentOfflineCardProps): ReactElement {
  const { onStart, canRelaunch } = props;
  const { provider } = useAgentDrawer();
  const providerLabel = providerDisplayName(provider);

  return (
    <AgentCard
      title="Agent is offline"
      description="Your JobPilot agent is installed but not running. Start it and it reconnects here automatically."
    >
      {canRelaunch && <StartAgentButton onStart={onStart} sx={{ alignSelf: "flex-start" }} />}

      <Stack spacing={0.5}>
        <Typography variant="captionMuted">In {providerLabel}, run setup:</Typography>
        <CopyField
          value={formatSkillCommand(provider, "setup")}
          copyMessage="Command copied"
          ariaLabel="Copy setup command"
        />
      </Stack>

      <Stack spacing={0.5}>
        <Typography variant="captionMuted">Or start it directly in any shell:</Typography>
        <CopyField value="jobpilot" copyMessage="Command copied" ariaLabel="Copy start command" />
      </Stack>

      <RecheckButton />
    </AgentCard>
  );
}
