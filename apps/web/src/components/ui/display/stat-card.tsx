"use client";

import type { ReactElement, ReactNode } from "react";
import { Box, Card, CardContent, Stack, Typography } from "@mui/material";

interface StatCardProps {
  label: string;
  value: ReactNode;
  hint?: string;
  trend?: ReactNode;
}

export function StatCard(props: StatCardProps): ReactElement {
  const { label, value, hint, trend } = props;
  return (
    <Card>
      <CardContent>
        <Stack spacing={0.5}>
          <Typography variant="overlineMuted">{label}</Typography>
          <Stack direction="row" spacing={1} sx={{ alignItems: "baseline" }}>
            <Typography variant="h2">{value}</Typography>
            {trend && <Box>{trend}</Box>}
          </Stack>
          {hint && <Typography variant="captionMuted">{hint}</Typography>}
        </Stack>
      </CardContent>
    </Card>
  );
}
