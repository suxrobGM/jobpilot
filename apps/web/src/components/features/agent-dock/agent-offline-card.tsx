"use client";

import type { ReactElement } from "react";
import { Button, Stack, Typography } from "@mui/material";
import { CopyField } from "@/components/ui/display";
import {
  formatSkillCommand,
  providerDisplayName,
  TERMINAL_PROTOCOL_URL,
  type TerminalProviderId,
} from "@/lib/terminal";
import { RecheckButton } from "./recheck-button";

interface AgentOfflineCardProps {
  onRecheck: () => void;
  provider: TerminalProviderId;
  /** Whether the host reported the jobpilot:// scheme is registered, so the browser can relaunch it. */
  canRelaunch: boolean;
}

/** Shown when a host previously connected from this browser but isn't answering now - installed, just stopped. */
export function AgentOfflineCard(props: AgentOfflineCardProps): ReactElement {
  const { onRecheck, provider, canRelaunch } = props;
  const providerLabel = providerDisplayName(provider);

  return (
    <Stack spacing={2} sx={{ flex: 1, minHeight: 0, p: 2, overflowY: "auto" }}>
      <Stack spacing={0.5}>
        <Typography variant="subtitle2">Agent is offline</Typography>
        <Typography variant="body2Muted">
          Your JobPilot agent is installed but not running. Start it and it reconnects here
          automatically.
        </Typography>
      </Stack>

      {canRelaunch && (
        <Button
          variant="contained"
          component="a"
          href={TERMINAL_PROTOCOL_URL}
          onClick={() => setTimeout(onRecheck, 1500)}
        >
          Start agent
        </Button>
      )}

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

      <RecheckButton onClick={onRecheck} />
    </Stack>
  );
}
