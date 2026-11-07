"use client";

import type { ReactElement } from "react";
import { LinearProgress, Stack, Typography } from "@mui/material";
import { SectionCard } from "@/components/ui/layout";

interface RankedEntry {
  label: string;
  count: number;
}

interface RankedBarListProps {
  title: string;
  eyebrow: string;
  entries: RankedEntry[];
  emptyMessage: string;
}

/** Labels with a bar scaled to the largest count, in their own card. */
export function RankedBarList(props: RankedBarListProps): ReactElement {
  const { title, eyebrow, entries, emptyMessage } = props;
  const max = entries.reduce((m, e) => Math.max(m, e.count), 0);

  return (
    <SectionCard eyebrow={eyebrow} title={title} fullHeight>
      {entries.length === 0 ? (
        <Typography variant="captionMuted">{emptyMessage}</Typography>
      ) : (
        <Stack spacing={1.25}>
          {entries.map((entry) => (
            <Stack key={entry.label} spacing={0.5}>
              <Stack direction="row" spacing={2} sx={{ justifyContent: "space-between" }}>
                {/* Failure reasons can run a paragraph; the full text is on hover. */}
                <Typography
                  variant="body1"
                  title={entry.label}
                  sx={{
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {entry.label}
                </Typography>
                <Typography variant="captionMuted">{entry.count}</Typography>
              </Stack>
              <LinearProgress
                variant="determinate"
                value={max > 0 ? (entry.count / max) * 100 : 0}
                sx={(t) => ({
                  height: 4,
                  borderRadius: t.radii.xs,
                  backgroundColor: t.palette.line.divider,
                  "& .MuiLinearProgress-bar": { backgroundColor: t.palette.accent.primary },
                })}
              />
            </Stack>
          ))}
        </Stack>
      )}
    </SectionCard>
  );
}
