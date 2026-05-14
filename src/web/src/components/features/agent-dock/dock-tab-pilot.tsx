"use client";

import type { ReactElement } from "react";
import { Box, Stack, Typography } from "@mui/material";
import { useAgent } from "@/providers/agent-provider";
import { AgentInput } from "./agent-input";

export function DockTabPilot(): ReactElement {
  const { currentFocus } = useAgent();

  return (
    <Stack sx={{ flex: 1, minHeight: 0 }}>
      <Stack
        spacing={1.75}
        sx={(theme) => ({
          flex: 1,
          minHeight: 0,
          padding: theme.spacing(2.25),
          overflowY: "auto",
        })}
      >
        <Typography variant="overlineMuted">Current focus</Typography>
        {currentFocus ? (
          <Box
            sx={(theme) => ({
              padding: theme.spacing(1.75),
              borderRadius: theme.radii.md,
              border: `1px solid ${theme.palette.accent.primary}30`,
              backgroundColor: `${theme.palette.accent.primary}0D`,
              fontStyle: "italic",
              fontSize: "0.8125rem",
              lineHeight: 1.55,
              letterSpacing: "-0.005em",
            })}
          >
            {currentFocus.message}
            <Stack
              direction="row"
              spacing={1.75}
              sx={(theme) => ({
                marginTop: theme.spacing(1.25),
                color: theme.palette.text.disabled,
                fontFamily: "var(--font-geist-mono), monospace",
                fontStyle: "normal",
                fontSize: "0.625rem",
              })}
            >
              <Box component="span">{currentFocus.step}</Box>
              <Box component="span">·</Box>
              <Box component="span">{currentFocus.jobKey}</Box>
            </Stack>
          </Box>
        ) : (
          <Typography variant="body2Muted">
            Pilot is idle. Ask it to queue a job, tailor a resume, or kick off the autopilot —
            anything you'd type as a slash command.
          </Typography>
        )}
      </Stack>
      <Box
        sx={(theme) => ({
          paddingInline: theme.spacing(2.25),
          paddingBlock: theme.spacing(1.5),
          borderTop: `1px solid ${theme.palette.line.divider}`,
        })}
      >
        <AgentInput />
      </Box>
    </Stack>
  );
}
