"use client";

import type { ReactElement } from "react";
import { Box, Skeleton, Stack, Tooltip, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { analyticsQueries } from "@/api/queries";
import { formatDayBucket, plural } from "@/utils/format";
import { SideSection } from "./side-section";

const WEEK_DAYS = 7;

/** Day buckets are UTC midnights, so the weekday is read in UTC. */
const dayInitial = (date: Date) =>
  date.toLocaleDateString(undefined, { weekday: "narrow", timeZone: "UTC" });

/** Whether the pilot is paying off: this week's applications and responses, one bar per day. */
export function WeekSummary(): ReactElement {
  const stats = useQuery(analyticsQueries.stats()).data;
  const days = stats?.perDay.slice(-WEEK_DAYS) ?? [];
  const most = Math.max(1, ...days.map((day) => day.count));
  const week = stats?.thisWeek;

  return (
    <SideSection title="This week">
      {week ? (
        <Typography variant="body1Strong">
          {`${week.submitted} applied · ${plural(week.interviewing, "interview")}`}
        </Typography>
      ) : (
        <Skeleton width="60%" />
      )}
      <Stack direction="row" spacing={0.5} sx={{ alignItems: "flex-end", height: 32 }}>
        {days.map((day) => (
          <Tooltip
            key={day.date.toISOString()}
            title={`${formatDayBucket(day.date)}: ${day.count}`}
          >
            <Box
              sx={{
                flex: 1,
                height: `${Math.max(day.count / most, 0.08) * 100}%`,
                bgcolor: day.count > 0 ? "primary.main" : "action.disabledBackground",
                borderRadius: 0.5,
              }}
            />
          </Tooltip>
        ))}
      </Stack>
      <Stack direction="row" spacing={0.5}>
        {days.map((day, index) => (
          <Typography
            key={day.date.toISOString()}
            variant="captionMuted"
            sx={{
              flex: 1,
              textAlign: "center",
              color: index === days.length - 1 ? "text.primary" : "text.secondary",
            }}
          >
            {dayInitial(day.date)}
          </Typography>
        ))}
      </Stack>
    </SideSection>
  );
}
