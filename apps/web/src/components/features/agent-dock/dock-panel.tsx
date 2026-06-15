"use client";

import type { ReactElement } from "react";
import { ChevronRight, RestartAlt, StopCircle } from "@mui/icons-material";
import {
  IconButton,
  MenuItem,
  Select,
  Stack,
  Tooltip,
  Typography,
  type SelectChangeEvent,
} from "@mui/material";
import { TerminalPanel } from "@/components/features/terminal";
import { PulseDot } from "@/components/ui/feedback";
import { useAgentDock } from "@/providers/agent-provider";
import { AgentOrb } from "./agent-orb";

export function DockPanel(): ReactElement {
  const { collapse, provider, switchProvider, restart, stop, terminalRevision } = useAgentDock();
  const providerLabel = provider === "codex" ? "Codex" : "Claude Code";

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
          paddingBlock: theme.spacing(1.25),
          borderBottom: `1px solid ${theme.palette.line.divider}`,
        })}
      >
        <Stack direction="row" spacing={1.25} sx={{ alignItems: "center", flex: 1, minWidth: 0 }}>
          <AgentOrb size="xxl" />
          <Stack sx={{ minWidth: 0 }}>
            <Typography variant="h6" sx={{ fontSize: "0.8125rem", fontWeight: 500 }}>
              Agent
            </Typography>
            <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", marginTop: "2px" }}>
              <PulseDot tone="muted" pulsing={false} size="xs" />
              <Typography variant="overlineMuted">ready</Typography>
            </Stack>
          </Stack>
        </Stack>
        <IconButton size="small" onClick={collapse} aria-label="Collapse agent dock">
          <ChevronRight fontSize="md" />
        </IconButton>
      </Stack>

      <Stack
        direction="row"
        spacing={0.75}
        sx={(theme) => ({
          alignItems: "center",
          paddingInline: theme.spacing(1.5),
          paddingBlock: theme.spacing(0.75),
          borderBottom: `1px solid ${theme.palette.line.divider}`,
        })}
      >
        <Typography variant="captionMuted" sx={{ flex: 1 }}>
          {providerLabel}
        </Typography>
        <Select
          size="small"
          value={provider}
          onChange={handleProviderChange}
          sx={{ minWidth: 120, fontSize: "0.75rem" }}
        >
          <MenuItem value="claude">Claude Code</MenuItem>
          <MenuItem value="codex">Codex</MenuItem>
        </Select>
        <Tooltip title={`Restart ${providerLabel}`}>
          <IconButton size="small" onClick={() => void restart()} aria-label="Restart">
            <RestartAlt fontSize="sm" />
          </IconButton>
        </Tooltip>
        <Tooltip title={`Stop ${providerLabel}`}>
          <IconButton size="small" onClick={() => void stop()} aria-label="Stop">
            <StopCircle fontSize="sm" />
          </IconButton>
        </Tooltip>
      </Stack>

      <TerminalPanel key={`${provider}-${terminalRevision}`} provider={provider} />
    </Stack>
  );
}
