"use client";

import type { ReactElement } from "react";
import { Card, CardContent, Stack, Typography } from "@mui/material";

interface StatCardProps {
  label: string;
  value: string | number;
  hint?: string;
  /** A palette color for the value; plain text when unset. */
  accent?: "success" | "error" | "warning";
}

export function StatCard(props: StatCardProps): ReactElement {
  const { label, value, hint, accent } = props;
  return (
    <Card sx={{ height: "100%" }}>
      <CardContent>
        <Stack spacing={0.5}>
          <Typography variant="overlineMuted">{label}</Typography>
          <Typography
            variant="statValue"
            sx={{ color: accent ? `${accent}.main` : "text.primary" }}
          >
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
