"use client";

import type { ReactElement } from "react";
import { Box, LinearProgress, Stack, Typography } from "@mui/material";
import { SectionCard } from "@/components/ui/layout/section-card";
import type { DashboardStats } from "@/types/api";

interface BoardBreakdownProps {
  stats: DashboardStats;
}

export function BoardBreakdown(props: BoardBreakdownProps): ReactElement {
  const { stats } = props;
  const max = Math.max(...stats.byBoard.map((b) => b.count), 1);

  return (
    <SectionCard title="Boards" description="Where your applications came from.">
      {stats.byBoard.length === 0 ? (
        <Typography variant="body2Muted">No data yet.</Typography>
      ) : (
        <Stack spacing={1}>
          {stats.byBoard.slice(0, 8).map((b) => (
            <Box key={b.board}>
              <Stack
                direction="row"
                sx={{ mb: 0.5, alignItems: "center", justifyContent: "space-between" }}
              >
                <Typography variant="body2">{b.board}</Typography>
                <Typography variant="captionMuted">{b.count}</Typography>
              </Stack>
              <LinearProgress
                variant="determinate"
                value={(b.count / max) * 100}
                sx={{ height: 6, borderRadius: 3 }}
                color="secondary"
              />
            </Box>
          ))}
        </Stack>
      )}
    </SectionCard>
  );
}
