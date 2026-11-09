"use client";

import type { ReactElement } from "react";
import { Typography } from "@mui/material";
import { PluginInstallCommands } from "@/components/features/install";
import { AgentCard } from "./agent-card";
import { RecheckButton } from "./recheck-button";

interface AgentInstallCardProps {
  title?: string;
  description?: string;
  /** Host-reported reason, e.g. a missing plugin tree. */
  detail?: string | null;
}

/** The local host is unreachable: plugin-first install plus recheck. */
export function AgentInstallCard(props: AgentInstallCardProps): ReactElement {
  const {
    title = "Install the JobPilot agent",
    description = "Add the JobPilot plugin to Claude Code or Codex, then run setup. It installs and starts the local agent, which connects here automatically.",
    detail,
  } = props;

  return (
    <AgentCard title={title} description={description}>
      {detail && (
        <Typography variant="captionMuted" sx={{ color: "error.main" }}>
          {detail}
        </Typography>
      )}
      <PluginInstallCommands />
      <RecheckButton />
    </AgentCard>
  );
}
