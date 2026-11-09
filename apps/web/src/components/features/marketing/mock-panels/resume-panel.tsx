import type { ReactElement } from "react";
import { Box, Paper, Stack, Typography } from "@mui/material";
import { AppWindow } from "./app-window";

const VARIANTS = [
  { name: "Base resume", target: "your source of truth", score: null },
  { name: "Stripe variant", target: "Senior Frontend Engineer", score: 92 },
  { name: "Vercel variant", target: "Design Engineer", score: 88 },
];

const LINES = [
  { id: "l1", width: 0.9 },
  { id: "l2", width: 0.65 },
  { id: "l3", width: 0.8 },
  { id: "l4", width: 0.5 },
  { id: "l5", width: 0.85 },
  { id: "l6", width: 0.7 },
  { id: "l7", width: 0.6 },
  { id: "l8", width: 0.75 },
];

function PagePreview(): ReactElement {
  return (
    <Box
      sx={(theme) => ({
        width: 104,
        flexShrink: 0,
        aspectRatio: "3 / 4",
        borderRadius: theme.radii.xs,
        backgroundColor: theme.palette.text.primary,
        padding: 1.25,
        display: { xs: "none", sm: "flex" },
        flexDirection: "column",
        gap: 0.75,
      })}
    >
      <Box sx={{ height: 6, width: "55%", backgroundColor: "surfaces.base", opacity: 0.8 }} />
      {LINES.map((line) => (
        <Box
          key={line.id}
          sx={{
            height: 3,
            width: `${line.width * 100}%`,
            backgroundColor: "surfaces.base",
            opacity: 0.25,
          }}
        />
      ))}
    </Box>
  );
}

export function ResumePanel(): ReactElement {
  return (
    <AppWindow page="resumes" title="Resumes">
      <Stack direction="row" spacing={2}>
        <Stack spacing={1} sx={{ flex: 1, minWidth: 0 }}>
          {VARIANTS.map((variant) => (
            <Paper key={variant.name} variant="inset" sx={{ padding: 1.25 }}>
              <Stack direction="row" spacing={1} sx={{ justifyContent: "space-between" }}>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body2Strong" noWrap>
                    {variant.name}
                  </Typography>
                  <Typography variant="captionMuted" noWrap sx={{ display: "block" }}>
                    {variant.target}
                  </Typography>
                </Box>
                {variant.score !== null && (
                  <Typography variant="monoCaption" color="success">
                    {variant.score}% match
                  </Typography>
                )}
              </Stack>
            </Paper>
          ))}
          <Typography variant="monoCaption" color="textDisabled">
            → rendered to PDF on save
          </Typography>
        </Stack>
        <PagePreview />
      </Stack>
    </AppWindow>
  );
}
