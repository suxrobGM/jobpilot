"use client";

import type { ReactElement } from "react";
import { Stack, Typography } from "@mui/material";
import { CopyField } from "@/components/ui/display";
import { formatSkillCommand, type TerminalProviderId } from "@/lib/terminal";

const MARKETPLACE_UPDATE_COMMAND = "/plugin marketplace update sukhrob-claude-plugins";

const RELOAD_PLUGINS_COMMAND = "/reload-plugins";

const CODEX_MARKETPLACE_UPDATE_COMMAND = "codex plugin marketplace upgrade sukhrob-codex-plugins";

const CODEX_PLUGIN_REFRESH_COMMAND = "codex plugin add jobpilot@sukhrob-codex-plugins";

/** Manual plugin + setup update path, shown when the one-click self-update is unavailable or failed. */
export function UpdateManualSteps(props: { provider: TerminalProviderId }): ReactElement {
  const { provider } = props;

  return (
    <Stack spacing={1}>
      {provider === "claude" ? (
        <>
          <Stack spacing={0.5}>
            <Typography variant="captionMuted">1. Update the JobPilot plugin:</Typography>
            <CopyField
              value={MARKETPLACE_UPDATE_COMMAND}
              copyMessage="Command copied"
              ariaLabel="Copy plugin update command"
            />
          </Stack>
          <Stack spacing={0.5}>
            <Typography variant="captionMuted">2. Reload plugins to pick up the update:</Typography>
            <CopyField
              value={RELOAD_PLUGINS_COMMAND}
              copyMessage="Command copied"
              ariaLabel="Copy reload plugins command"
            />
          </Stack>
        </>
      ) : (
        <>
          <Stack spacing={0.5}>
            <Typography variant="captionMuted">
              1. Update the JobPilot marketplace (in a shell):
            </Typography>
            <CopyField
              value={CODEX_MARKETPLACE_UPDATE_COMMAND}
              copyMessage="Command copied"
              ariaLabel="Copy marketplace update command"
            />
          </Stack>
          <Stack spacing={0.5}>
            <Typography variant="captionMuted">2. Refresh the installed plugin:</Typography>
            <CopyField
              value={CODEX_PLUGIN_REFRESH_COMMAND}
              copyMessage="Command copied"
              ariaLabel="Copy plugin refresh command"
            />
          </Stack>
        </>
      )}
      <Stack spacing={0.5}>
        <Typography variant="captionMuted">
          {provider === "claude"
            ? "3. Update the agent (restarts it, self-updating):"
            : "3. Start a new Codex session, then update the agent:"}
        </Typography>
        <CopyField
          value={formatSkillCommand(provider, "setup")}
          copyMessage="Command copied"
          ariaLabel="Copy setup command"
        />
      </Stack>
    </Stack>
  );
}
