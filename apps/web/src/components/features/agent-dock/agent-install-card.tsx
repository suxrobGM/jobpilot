"use client";

import type { ReactElement } from "react";
import { Stack, Typography } from "@mui/material";
import { PluginInstallCommands } from "@/components/features/install";
import { RecheckButton } from "./recheck-button";

interface AgentInstallCardProps {
  onRecheck: () => void;
  /** Override for the degraded-host case (running but broken install). */
  title?: string;
  description?: string;
  /** Host-reported reason shown under the description (e.g. missing plugin tree). */
  detail?: string | null;
}

/** Shown in the dock when the local terminal host is unreachable: plugin-first install + recheck. */
export function AgentInstallCard(props: AgentInstallCardProps): ReactElement {
  const { onRecheck, title, description, detail } = props;

  return (
    <Stack spacing={2} sx={{ flex: 1, minHeight: 0, p: 2, overflowY: "auto" }}>
      <Stack spacing={0.5}>
        <Typography variant="body1Strong">{title ?? "Install the JobPilot agent"}</Typography>
        <Typography variant="body2Muted">
          {description ??
            "Add the JobPilot plugin to Claude Code or Codex, then run setup - it installs and starts the local agent, which connects here automatically."}
        </Typography>
        {detail && (
          <Typography variant="captionMuted" sx={{ color: "error.main" }}>
            {detail}
          </Typography>
        )}
      </Stack>

      <PluginInstallCommands />

      <RecheckButton onClick={onRecheck} />
    </Stack>
  );
}
