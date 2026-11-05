"use client";

import type { ReactElement } from "react";
import { Card, CardContent, Stack, Typography } from "@mui/material";

type StatCardAccent = "default" | "success" | "danger" | "warning";

const ACCENT_COLOR: Record<StatCardAccent, string> = {
  default: "text.primary",
  success: "success.main",
  danger: "error.main",
  warning: "warning.main",
};

interface StatCardProps {
  label: string;
  value: string | number;
  hint?: string;
  accent?: StatCardAccent;
}

export function StatCard(props: StatCardProps): ReactElement {
  const { label, value, hint, accent = "default" } = props;
  return (
    <Card sx={{ height: "100%" }}>
      <CardContent>
        <Stack spacing={0.5}>
          <Typography variant="statLabel">{label}</Typography>
          <Typography variant="statValue" sx={{ color: ACCENT_COLOR[accent] }}>
            {value}
          </Typography>
          {/* Reserved even when empty, so a row of cards keeps one baseline. */}
          <Typography variant="captionMuted" sx={{ minHeight: "1em" }}>
            {hint ?? ""}
          </Typography>
        </Stack>
      </CardContent>
    </Card>
  );
}
