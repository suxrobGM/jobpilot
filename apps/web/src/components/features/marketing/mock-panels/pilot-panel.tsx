import type { ReactElement } from "react";
import { Box, Paper, Stack, Typography } from "@mui/material";
import { PanelFrame } from "./panel-frame";

const WORK = [
  "✓ ML Engineer, New Grad · Duolingo · 82",
  "✓ Research Assistant · CMU Robotics · 77",
  "· Scored 24 jobs for ML engineer, new grad",
];

export function PilotPanel(): ReactElement {
  return (
    <PanelFrame label="pilot">
      <Stack spacing={1.25}>
        <Paper variant="inset" sx={{ padding: 1.25 }}>
          <Typography variant="captionMuted">
            9:10–9:52 · Applied to 2 jobs · ran 1 search
          </Typography>
          {WORK.map((line) => (
            <Typography key={line} variant="body2" noWrap>
              {line}
            </Typography>
          ))}
        </Paper>
        <Box sx={{ alignSelf: "flex-end", maxWidth: "80%" }}>
          <Paper variant="inset" sx={{ padding: 1.25 }}>
            <Typography variant="body2">
              Stop applying to jobs that need clearance, and add university labs in PA.
            </Typography>
          </Paper>
        </Box>
        <Paper variant="inset" sx={{ padding: 1.25 }}>
          <Typography variant="body2">Done. Added a rule and a search.</Typography>
          <Stack direction="row" sx={{ justifyContent: "space-between", mt: 0.5 }}>
            <Typography variant="captionMuted">+ Skip jobs that need clearance</Typography>
            <Typography variant="caption" color="primary">
              Undo
            </Typography>
          </Stack>
        </Paper>
        <Typography variant="monoCaption" color="textDisabled">
          → ask or tell your pilot…
        </Typography>
      </Stack>
    </PanelFrame>
  );
}
