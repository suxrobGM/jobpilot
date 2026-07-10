"use client";

import type { ReactElement } from "react";
import { Box, Stack, Typography } from "@mui/material";
import { editorial, fontFamilies } from "@/theme";
import { PanelFrame, panelCellSx } from "./panel-frame";

const VARIANTS = [
  { name: "Base resume", target: "your source of truth", score: "" },
  { name: "Stripe variant", target: "Senior Frontend Engineer", score: "92" },
  { name: "Vercel variant", target: "Design Engineer", score: "88" },
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

/** Faux rendered-PDF page: paper block with skeleton text lines. */
function PagePreview(): ReactElement {
  return (
    <Box
      sx={(theme) => ({
        width: 104,
        flexShrink: 0,
        aspectRatio: "3 / 4",
        borderRadius: theme.radii.xs,
        backgroundColor: editorial.paper,
        padding: 1.25,
        display: "flex",
        flexDirection: "column",
        gap: 0.75,
      })}
    >
      <Box sx={{ height: 6, width: "55%", backgroundColor: editorial.ink, opacity: 0.8 }} />
      {LINES.map((line) => (
        <Box
          key={line.id}
          sx={{
            height: 3,
            width: `${line.width * 100}%`,
            backgroundColor: editorial.ink,
            opacity: 0.25,
          }}
        />
      ))}
    </Box>
  );
}

export function ResumePanel(): ReactElement {
  return (
    <PanelFrame label="resume studio">
      <Stack direction="row" spacing={2}>
        <Stack spacing={1} sx={{ flex: 1, minWidth: 0 }}>
          {VARIANTS.map((variant) => (
            <Box key={variant.name} sx={[panelCellSx, { padding: 1.25 }]}>
              <Stack direction="row" spacing={1} sx={{ justifyContent: "space-between" }}>
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontSize: "0.75rem", fontWeight: 600 }} noWrap>
                    {variant.name}
                  </Typography>
                  <Typography variant="captionMuted" noWrap sx={{ display: "block" }}>
                    {variant.target}
                  </Typography>
                </Box>
                {variant.score && (
                  <Typography
                    sx={{
                      fontFamily: fontFamilies.mono,
                      fontSize: "0.75rem",
                      color: "success.main",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {variant.score}%
                  </Typography>
                )}
              </Stack>
            </Box>
          ))}
          <Typography
            sx={{ fontFamily: fontFamilies.mono, fontSize: "0.6875rem", color: "text.disabled" }}
          >
            → rendered to PDF on save
          </Typography>
        </Stack>
        <PagePreview />
      </Stack>
    </PanelFrame>
  );
}
