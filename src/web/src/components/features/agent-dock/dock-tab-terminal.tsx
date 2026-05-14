"use client";

import { useState, type ReactElement } from "react";
import { RestartAlt, StopCircle } from "@mui/icons-material";
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
import { killSession } from "@/lib/terminal";
import { useAgent } from "@/providers/agent-provider";

export function DockTabTerminal(): ReactElement {
  const { provider, setProvider } = useAgent();
  const [reloadKey, setReloadKey] = useState(0);
  const providerLabel = provider === "codex" ? "Codex" : "Claude Code";

  const handleStop = async (): Promise<void> => {
    await killSession();
  };

  const handleRestart = async (): Promise<void> => {
    await killSession();
    setReloadKey((k) => k + 1);
  };

  const handleProviderChange = async (event: SelectChangeEvent<string>): Promise<void> => {
    const next = event.target.value === "codex" ? "codex" : "claude";
    if (next === provider) return;
    await killSession();
    setProvider(next);
    setReloadKey((k) => k + 1);
  };

  return (
    <Stack sx={{ flex: 1, minHeight: 0 }}>
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
          <IconButton size="small" onClick={handleRestart} aria-label="Restart">
            <RestartAlt fontSize="sm" />
          </IconButton>
        </Tooltip>
        <Tooltip title={`Stop ${providerLabel}`}>
          <IconButton size="small" onClick={handleStop} aria-label="Stop">
            <StopCircle fontSize="sm" />
          </IconButton>
        </Tooltip>
      </Stack>
      <TerminalPanel key={`${provider}-${reloadKey}`} provider={provider} />
    </Stack>
  );
}
