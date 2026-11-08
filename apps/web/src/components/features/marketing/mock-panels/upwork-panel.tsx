import type { ReactElement } from "react";
import { Paper, Stack, Typography } from "@mui/material";
import { AppWindow } from "./app-window";

const CLIENT_MARKERS = ["$40k+ spent", "92% hire rate", "4.9 rating", "payment verified"];

export function UpworkPanel(): ReactElement {
  return (
    <AppWindow page="upwork" title="Proposals">
      <Stack spacing={1.5}>
        <Paper variant="inset" sx={{ padding: 1.5 }}>
          <Stack spacing={1}>
            <Typography variant="body1Strong">
              Build a Next.js dashboard for a logistics startup
            </Typography>
            <Typography variant="captionMuted">Fixed price · $4,500 · Expert</Typography>
            <Stack direction="row" sx={{ flexWrap: "wrap", gap: 0.75 }}>
              {CLIENT_MARKERS.map((marker) => (
                <Typography key={marker} variant="monoChip">
                  {marker}
                </Typography>
              ))}
            </Stack>
          </Stack>
        </Paper>
        <Paper variant="inset" sx={{ padding: 1.5 }}>
          <Stack spacing={0.75}>
            <Typography variant="overlineMuted">Proposal draft</Typography>
            <Typography variant="body2Muted">
              Hi Dana, I've shipped three Next.js dashboards for logistics teams, most recently a
              live fleet tracker with 2,000 vehicles. Here is how I'd approach yours...
            </Typography>
          </Stack>
        </Paper>
        <Stack spacing={0.5}>
          <Typography variant="monoCaption" color="textDisabled">
            ✕ 14 jobs dropped · low hire rate, no spend history
          </Typography>
          <Typography variant="monoCaption" color="success">
            ✓ proposal drafted · awaiting your review
          </Typography>
        </Stack>
      </Stack>
    </AppWindow>
  );
}
