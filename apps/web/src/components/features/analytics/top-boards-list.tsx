"use client";

import type { ReactElement } from "react";
import { Card, CardContent, LinearProgress, Stack, Typography } from "@mui/material";

interface TopBoardsListProps {
  title: string;
  eyebrow: string;
  entries: { label: string; count: number }[];
  emptyMessage: string;
}

export function TopBoardsList(props: TopBoardsListProps): ReactElement {
  const { title, eyebrow, entries, emptyMessage } = props;
  const max = entries.reduce((m, e) => Math.max(m, e.count), 0);

  return (
    <Card sx={{ height: "100%" }}>
      <CardContent>
        <Typography variant="overlineMuted">{eyebrow}</Typography>
        <Typography variant="h5" sx={{ mt: 0.5, mb: 2 }}>
          {title}
        </Typography>

        {entries.length === 0 ? (
          <Typography variant="captionMuted">{emptyMessage}</Typography>
        ) : (
          <Stack spacing={1.25}>
            {entries.map((entry) => {
              const pct = max > 0 ? (entry.count / max) * 100 : 0;
              return (
                <Stack key={entry.label} spacing={0.5}>
                  <Stack direction="row" sx={{ justifyContent: "space-between" }}>
                    <Typography variant="body2" sx={{ fontSize: "0.8125rem" }}>
                      {entry.label}
                    </Typography>
                    <Typography variant="captionMuted">{entry.count}</Typography>
                  </Stack>
                  <LinearProgress
                    variant="determinate"
                    value={pct}
                    sx={(t) => ({
                      height: 4,
                      borderRadius: 2,
                      backgroundColor: t.palette.line.divider,
                      "& .MuiLinearProgress-bar": {
                        backgroundColor: t.palette.accent.primary,
                      },
                    })}
                  />
                </Stack>
              );
            })}
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}
