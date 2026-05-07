"use client";

import { Box, Stack, Typography } from "@mui/material";
import type { ReactElement } from "react";
import { StageChip } from "@/components/ui/display/stage-chip";
import type { StageEventDto } from "@/types/api";

interface StageTimelineProps {
  events: ReadonlyArray<StageEventDto>;
}

export function StageTimeline(props: StageTimelineProps): ReactElement {
  const { events } = props;
  if (events.length === 0) {
    return <Typography variant="body2Muted">No stage events yet.</Typography>;
  }
  return (
    <Stack spacing={1.25}>
      {events.map((e) => (
        <Stack
          key={e.id}
          direction="row"
          spacing={2}
          sx={(t) => ({
            alignItems: "flex-start",
            p: 1.25,
            borderRadius: t.radii.sm,
            border: `1px solid ${t.palette.line.divider}`,
          })}
        >
          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
            {e.fromStage && (
              <>
                <StageChip stage={e.fromStage} />
                <Typography variant="captionMuted">→</Typography>
              </>
            )}
            <StageChip stage={e.toStage} />
          </Stack>
          <Box sx={{ flex: 1 }}>
            {e.note && <Typography variant="body2">{e.note}</Typography>}
            <Typography variant="captionMuted">
              {new Date(e.occurredAt).toLocaleString()}
            </Typography>
          </Box>
        </Stack>
      ))}
    </Stack>
  );
}
