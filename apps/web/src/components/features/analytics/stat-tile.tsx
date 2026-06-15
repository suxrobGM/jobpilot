"use client";

import type { ReactElement } from "react";
import { Card, CardContent, Stack, Typography } from "@mui/material";

type StatTileAccent = "default" | "success" | "danger" | "warning";

const ACCENT_COLOR: Record<StatTileAccent, string> = {
  default: "text.primary",
  success: "success.main",
  danger: "error.main",
  warning: "warning.main",
};

interface StatTileProps {
  label: string;
  value: string | number;
  hint?: string;
  accent?: StatTileAccent;
}

export function StatTile(props: StatTileProps): ReactElement {
  const { label, value, hint, accent = "default" } = props;
  return (
    <Card sx={{ height: "100%" }}>
      <CardContent>
        <Stack spacing={0.5}>
          <Typography variant="statLabel">{label}</Typography>
          <Typography variant="statValue" sx={{ color: ACCENT_COLOR[accent] }}>
            {value}
          </Typography>
          <Typography variant="captionMuted" sx={{ minHeight: "1em" }}>
            {hint ?? ""}
          </Typography>
        </Stack>
      </CardContent>
    </Card>
  );
}
