"use client";

import type { ReactElement } from "react";
import { Box, Card, CardContent, Stack, Typography } from "@mui/material";
import type { ApplicationEventDto } from "@/api/types";
import { RelativeTime, StatusChip } from "@/components/ui/display";
import { EmptyState } from "@/components/ui/feedback";

interface ActivityTimelineProps {
  events: ReadonlyArray<ApplicationEventDto>;
}

export function ActivityTimeline(props: ActivityTimelineProps): ReactElement {
  const { events } = props;
  if (events.length === 0) {
    return <EmptyState variant="inline" title="No activity yet." />;
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
                      <StatusChip domain="application" value={e.fromStatus} />
                      <Typography variant="captionMuted">→</Typography>
                    </>
                  )}
                  <StatusChip domain="application" value={e.toStatus} />
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
