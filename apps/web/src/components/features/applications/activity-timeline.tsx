"use client";

import type { ReactElement } from "react";
import { Box, Card, CardContent, Stack, Typography } from "@mui/material";
import type { ApplicationEventDto } from "@/api/types";
import { RelativeTime, StatusChip } from "@/components/ui/display";

interface ActivityTimelineProps {
  events: ReadonlyArray<ApplicationEventDto>;
}

export function ActivityTimeline(props: ActivityTimelineProps): ReactElement {
  const { events } = props;
  if (events.length === 0) {
    return <Typography variant="body2Muted">No activity yet.</Typography>;
  }
  return (
    <Stack spacing={1.25}>
      {events.map((e) => (
        <Card key={e.id}>
          <CardContent>
            <Stack direction="row" spacing={2} sx={{ alignItems: "flex-start" }}>
              {e.toStatus && (
                <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                  {e.fromStatus && (
                    <>
                      <StatusChip status={e.fromStatus} />
                      <Typography variant="captionMuted">→</Typography>
                    </>
                  )}
                  <StatusChip status={e.toStatus} />
                </Stack>
              )}
              <Box sx={{ flex: 1 }}>
                {e.note && <Typography variant="body2">{e.note}</Typography>}
                <RelativeTime value={e.createdAt} />
              </Box>
            </Stack>
          </CardContent>
        </Card>
      ))}
    </Stack>
  );
}
