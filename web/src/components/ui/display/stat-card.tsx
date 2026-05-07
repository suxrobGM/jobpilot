"use client";

import type { ReactElement, ReactNode } from "react";
import { Box, Stack, Typography } from "@mui/material";

interface StatCardProps {
  label: string;
  value: ReactNode;
  hint?: string;
  trend?: ReactNode;
}

export function StatCard(props: StatCardProps): ReactElement {
  const { label, value, hint, trend } = props;
  return (
    <Box
      sx={(t) => ({
        p: 2.5,
        border: `1px solid ${t.palette.line.divider}`,
        borderRadius: t.radii.md,
        backgroundColor: t.palette.surfaces.card,
        boxShadow: t.shadows_custom.sm,
      })}
    >
      <Stack spacing={0.5}>
        <Typography variant="overlineMuted">{label}</Typography>
        <Stack direction="row" spacing={1} sx={{ alignItems: "baseline" }}>
          <Typography variant="h2">{value}</Typography>
          {trend && <Box>{trend}</Box>}
        </Stack>
        {hint && <Typography variant="captionMuted">{hint}</Typography>}
      </Stack>
    </Box>
  );
}
