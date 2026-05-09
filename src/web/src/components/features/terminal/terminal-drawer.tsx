"use client";

import { useState, type MouseEvent as ReactMouseEvent, type ReactElement } from "react";
import { Close, RestartAlt, StopCircle } from "@mui/icons-material";
import {
  Box,
  IconButton,
  MenuItem,
  Select,
  Stack,
  Tooltip,
  Typography,
  type SelectChangeEvent,
} from "@mui/material";
import { killSession } from "@/lib/terminal";
import { useTerminal } from "@/providers/terminal-provider";
import { TerminalPanel } from "./terminal-panel";

const MIN_HEIGHT = 240;
const MAX_HEIGHT = 720;
const DEFAULT_HEIGHT = 480;

/**
 * Renders the resizable terminal drawer and its session controls.
 */
export function TerminalDrawer(): ReactElement {
  const { open, provider, setOpen, setProvider } = useTerminal();
  const [height, setHeight] = useState(DEFAULT_HEIGHT);
  const [reloadKey, setReloadKey] = useState(0);

  if (!open) {
    return <></>;
  }

  const startDrag = (event: ReactMouseEvent): void => {
    event.preventDefault();
    const startY = event.clientY;
    const startHeight = height;

    const onMove = (e: MouseEvent): void => {
      const next = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, startHeight + (startY - e.clientY)));
      setHeight(next);
    };
    const onUp = (): void => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  const handleStop = async (): Promise<void> => {
    await killSession();
  };

  const handleRestart = async (): Promise<void> => {
    await killSession();
    setReloadKey((k) => k + 1);
  };

  const handleProviderChange = async (event: SelectChangeEvent): Promise<void> => {
    const nextProvider = event.target.value === "codex" ? "codex" : "claude";
    if (nextProvider === provider) return;

    await killSession();
    setProvider(nextProvider);
    setReloadKey((k) => k + 1);
  };

  const providerLabel = provider === "codex" ? "Codex" : "Claude Code";

  return (
    <Box
      sx={(t) => ({
        height,
        flexShrink: 0,
        borderTop: `1px solid ${t.palette.line.divider}`,
        backgroundColor: t.palette.surfaces.base,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      })}
    >
      <Box
        onMouseDown={startDrag}
        sx={(t) => ({
          height: 6,
          flexShrink: 0,
          cursor: "ns-resize",
          backgroundColor: t.palette.line.divider,
          "&:hover": { backgroundColor: t.palette.line.border },
        })}
      />
      <Stack
        direction="row"
        sx={(t) => ({
          alignItems: "center",
          gap: 0.5,
          flexShrink: 0,
          px: 1.5,
          py: 0.5,
          borderBottom: `1px solid ${t.palette.line.divider}`,
        })}
      >
        <Typography variant="captionMuted" sx={{ flex: 1 }}>
          {providerLabel} - JobPilot.Terminal
        </Typography>
        <Select
          size="small"
          value={provider}
          onChange={handleProviderChange}
          sx={{ minWidth: 132 }}
        >
          <MenuItem value="claude">Claude Code</MenuItem>
          <MenuItem value="codex">Codex</MenuItem>
        </Select>
        <Tooltip title={`Restart ${providerLabel}`}>
          <IconButton size="small" onClick={handleRestart}>
            <RestartAlt fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title={`Stop ${providerLabel}`}>
          <IconButton size="small" onClick={handleStop}>
            <StopCircle fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Hide terminal">
          <IconButton size="small" onClick={() => setOpen(false)}>
            <Close fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>
      <TerminalPanel key={`${provider}-${reloadKey}`} provider={provider} />
    </Box>
  );
}
