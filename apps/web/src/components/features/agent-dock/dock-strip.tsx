"use client";

import type { ReactElement } from "react";
import { ChevronLeft, Terminal as TerminalIcon } from "@mui/icons-material";
import { Box, IconButton, Stack, Tooltip } from "@mui/material";
import { useAgentDock } from "@/providers/agent-provider";
import { AgentOrb } from "./agent-orb";

export function DockStrip(): ReactElement {
  const { expand } = useAgentDock();

  return (
    <Stack
      spacing={1.25}
      sx={(theme) => ({
        alignItems: "center",
        width: "100%",
        height: "100%",
        paddingBlock: theme.spacing(1.5),
      })}
    >
      <Tooltip title="Open agent dock" placement="left" arrow disableInteractive>
        <Box
          component="button"
          onClick={() => expand()}
          aria-label="Open agent dock"
          sx={(theme) => ({
            appearance: "none",
            border: "none",
            background: "transparent",
            padding: 0,
            cursor: "pointer",
            borderRadius: "50%",
            display: "grid",
            placeItems: "center",
            "&:focus-visible": { boxShadow: theme.shadows_custom.focus },
          })}
        >
          <AgentOrb size="2xxl" />
        </Box>
      </Tooltip>

      <Box sx={{ flex: 1 }} />

      <Tooltip title="Open terminal" placement="left" arrow disableInteractive>
        <IconButton size="small" onClick={() => expand()} aria-label="Open terminal">
          <TerminalIcon fontSize="sm" />
        </IconButton>
      </Tooltip>

      <Tooltip title="Expand" placement="left" arrow disableInteractive>
        <IconButton size="small" onClick={() => expand()} aria-label="Expand dock">
          <ChevronLeft fontSize="md" />
        </IconButton>
      </Tooltip>
    </Stack>
  );
}
