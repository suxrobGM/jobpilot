import type { ReactElement } from "react";
import { Chip, type ChipProps, Paper, Stack, Typography } from "@mui/material";
import { PanelFrame } from "./panel-frame";

interface Mode {
  title: string;
  body: string;
  color: ChipProps["color"];
}

const MODES: Mode[] = [
  {
    title: "Search",
    body: "Find and score jobs. You pick which ones to apply to.",
    color: "info",
  },
  {
    title: "Auto-apply",
    body: "Apply to your best matches, up to a limit you set.",
    color: "primary",
  },
  {
    title: "Apply to links",
    body: "Paste job links. Each gets a tailored resume.",
    color: "success",
  },
  {
    title: "Networking",
    body: "Find the hiring manager and draft a message.",
    color: "warning",
  },
];

export function CampaignsPanel(): ReactElement {
  return (
    <PanelFrame label="new campaign">
      <Stack spacing={1}>
        {MODES.map((mode) => (
          <Paper
            key={mode.title}
            variant="inset"
            sx={{ padding: 1.25, display: "flex", alignItems: "center", gap: 1.5 }}
          >
            <Chip variant="outlined" color={mode.color} label={mode.title} sx={{ minWidth: 104 }} />
            <Typography variant="captionMuted" noWrap>
              {mode.body}
            </Typography>
          </Paper>
        ))}
        <Typography variant="monoCaption" color="textDisabled">
          → you start it, you watch it run
        </Typography>
      </Stack>
    </PanelFrame>
  );
}
