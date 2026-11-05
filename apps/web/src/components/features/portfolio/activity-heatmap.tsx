"use client";

import type { ReactElement } from "react";
import { Box, Stack, Typography } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import type { PortfolioDayPoint } from "@/api/types";
import { radii } from "@/theme";
import { formatDayBucket } from "@/utils/format";

interface ActivityHeatmapProps {
  perDay: PortfolioDayPoint[];
}

const LEGEND_LEVELS = [0, 1, 2, 3, 4] as const;

const CELL = 11; // px, one day square
const GAP = 3; // px, between squares
const STRIDE = CELL + GAP; // px, one column step
const WEEKDAY_W = 26; // px, left axis label gutter

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
// Grid rows are Sun(0)..Sat(6); GitHub labels only Mon/Wed/Fri to avoid crowding.
const WEEKDAYS = ["", "Mon", "", "Wed", "", "Fri", ""];

/** 0 = empty, 1-4 = increasing activity. Fixed thresholds read consistently across users. */
function level(count: number): number {
  if (count <= 0) {
    return 0;
  }
  if (count < 3) {
    return 1;
  }
  if (count < 6) {
    return 2;
  }
  if (count < 10) {
    return 3;
  }
  return 4;
}

/** GitHub-style contribution grid: weeks as columns, weekday as rows. Days are UTC (see buckets). */
export function ActivityHeatmap(props: ActivityHeatmapProps): ReactElement {
  const { perDay } = props;
  const theme = useTheme();

  const shade = (lvl: number): string =>
    lvl === 0
      ? alpha(theme.palette.text.disabled, 0.14)
      : alpha(theme.palette.success.main, 0.25 * lvl);

  // The earliest day's weekday sets where column 0 starts; every later day auto-flows from there.
  const leadPad = perDay.length > 0 ? perDay[0].date.getUTCDay() : 0;
  const columns = Math.ceil((leadPad + perDay.length) / 7);

  // Month label placed at the column where its month first appears (top axis).
  const ticks: { col: number; label: string }[] = [];
  let lastMonth = -1;
  for (let col = 0; col < columns; col++) {
    const month = perDay[Math.max(0, col * 7 - leadPad)].date.getUTCMonth();
    if (month !== lastMonth) {
      ticks.push({ col, label: MONTHS[month] });
      lastMonth = month;
    }
  }

  return (
    <Stack spacing={1}>
      <Box sx={{ overflowX: "auto", pb: 0.5 }}>
        <Box sx={{ width: "max-content" }}>
          {/* Top axis: month labels, absolutely placed at their starting column. */}
          <Box sx={{ display: "flex" }}>
            <Box sx={{ width: WEEKDAY_W, flexShrink: 0 }} />
            <Box sx={{ position: "relative", height: 16, width: columns * STRIDE }}>
              {ticks.map((tick) => (
                <Typography
                  key={tick.col}
                  variant="captionMuted"
                  sx={{ position: "absolute", left: tick.col * STRIDE, typography: "caption" }}
                >
                  {tick.label}
                </Typography>
              ))}
            </Box>
          </Box>

          <Box sx={{ display: "flex" }}>
            {/* Left axis: weekday labels, aligned row-for-row with the grid. */}
            <Box
              sx={{
                width: WEEKDAY_W,
                flexShrink: 0,
                display: "grid",
                gridTemplateRows: `repeat(7, ${CELL}px)`,
                rowGap: `${GAP}px`,
                pr: 0.5,
              }}
            >
              {WEEKDAYS.map((label, row) => (
                <Typography
                  // biome-ignore lint/suspicious/noArrayIndexKey: fixed 7-row weekday axis
                  key={`wd-${row}`}
                  variant="captionMuted"
                  sx={{ typography: "caption", lineHeight: `${CELL}px`, textAlign: "right" }}
                >
                  {label}
                </Typography>
              ))}
            </Box>

            <Box
              sx={{
                display: "grid",
                gridTemplateRows: `repeat(7, ${CELL}px)`,
                gridAutoFlow: "column",
                gridAutoColumns: "min-content",
                gap: `${GAP}px`,
              }}
            >
              {perDay.map((day, i) => (
                // Native `title`, not a MUI Tooltip: ~365 cells, a Popper per cell is far too heavy.
                <Box
                  key={day.date.getTime()}
                  title={`${day.count} ${day.count === 1 ? "activity" : "activities"} · ${formatDayBucket(day.date)}`}
                  sx={{
                    // Offset only the first square to its weekday row; the rest auto-flow down columns.
                    gridRow: i === 0 ? leadPad + 1 : undefined,
                    width: CELL,
                    height: CELL,
                    borderRadius: radii.xs,
                    backgroundColor: shade(level(day.count)),
                  }}
                />
              ))}
            </Box>
          </Box>
        </Box>
      </Box>
      <Stack
        direction="row"
        spacing={0.75}
        sx={{ alignItems: "center", justifyContent: "flex-end" }}
      >
        <Typography variant="captionMuted">Less</Typography>
        {LEGEND_LEVELS.map((lvl) => (
          <Box
            key={`legend-${lvl}`}
            sx={{ width: CELL, height: CELL, borderRadius: radii.xs, backgroundColor: shade(lvl) }}
          />
        ))}
        <Typography variant="captionMuted">More</Typography>
      </Stack>
    </Stack>
  );
}
