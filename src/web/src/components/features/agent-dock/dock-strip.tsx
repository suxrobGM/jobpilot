"use client";

import type { ReactElement } from "react";
import { ChevronLeft, Terminal as TerminalIcon } from "@mui/icons-material";
import { Box, IconButton, Stack, Tooltip, Typography } from "@mui/material";
import { PilotOrb } from "@/components/ui/display";
import { useAgent } from "@/providers/agent-provider";

export function DockStrip(): ReactElement {
  const { expand, status } = useAgent();
  const live = status === "working" || status === "awaiting-input";

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
      <Tooltip title="Open Pilot" placement="left" arrow disableInteractive>
        <Box
          component="button"
          onClick={() => expand("pilot")}
          aria-label="Open Pilot"
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
          <PilotOrb size={32} liveDot={live} />
        </Box>
      </Tooltip>

      <Typography
        variant="overlineMuted"
        sx={{
          writingMode: "vertical-rl",
          transform: "rotate(180deg)",
          letterSpacing: "0.18em",
        }}
      >
        Pilot
      </Typography>

      <Box sx={{ flex: 1 }} />

      <Tooltip title="Open terminal" placement="left" arrow disableInteractive>
        <IconButton size="small" onClick={() => expand("terminal")} aria-label="Open terminal">
          <TerminalIcon fontSize="sm" />
        </IconButton>
      </Tooltip>

      <Tooltip title="Expand" placement="left" arrow disableInteractive>
        <IconButton size="small" onClick={() => expand("pilot")} aria-label="Expand dock">
          <ChevronLeft fontSize="md" />
        </IconButton>
      </Tooltip>
    </Stack>
  );
}
