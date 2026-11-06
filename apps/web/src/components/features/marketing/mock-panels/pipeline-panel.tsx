import type { ReactElement } from "react";
import { Box, Chip, type ChipProps, Paper, Stack, Typography } from "@mui/material";
import { PanelFrame } from "./panel-frame";

const FUNNEL = [
  { label: "Applied", count: 47, dot: "stages.applying" },
  { label: "Screening", count: 4, dot: "warning.main" },
  { label: "Interviewing", count: 2, dot: "primary.main" },
  { label: "Offer", count: 2, dot: "success.main" },
];

interface MockApplication {
  company: string;
  role: string;
  status: string;
  color: ChipProps["color"];
}

const APPLICATIONS: MockApplication[] = [
  { company: "Stripe", role: "Senior Frontend Engineer", status: "Applied", color: "secondary" },
  { company: "Vercel", role: "Design Engineer", status: "Interviewing", color: "primary" },
  { company: "Supabase", role: "Senior TypeScript Engineer", status: "Offer", color: "success" },
];

export function PipelinePanel(): ReactElement {
  return (
    <PanelFrame label="pipeline · applied">
      <Stack spacing={1.5}>
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 1 }}>
          {FUNNEL.map((group) => (
            <Paper key={group.label} variant="inset" sx={{ padding: 1 }}>
              <Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
                <Box
                  sx={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: group.dot }}
                />
                <Typography variant="statLabel" noWrap>
                  {group.label}
                </Typography>
              </Stack>
              <Typography variant="statValue" component="p" sx={{ mt: 0.5 }}>
                {group.count}
              </Typography>
            </Paper>
          ))}
        </Box>
        <Stack spacing={1}>
          {APPLICATIONS.map((app) => (
            <Paper
              key={app.company}
              variant="inset"
              sx={{
                padding: 1.25,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 1,
              }}
            >
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="body2Strong" noWrap>
                  {app.company}
                </Typography>
                <Typography variant="captionMuted" noWrap sx={{ display: "block" }}>
                  {app.role}
                </Typography>
              </Box>
              <Chip variant="outlined" color={app.color} label={app.status} />
            </Paper>
          ))}
        </Stack>
        <Typography variant="monoCaption" color="textDisabled">
          6 statuses · applied → offer
        </Typography>
      </Stack>
    </PanelFrame>
  );
}
