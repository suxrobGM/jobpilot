"use client";

import type { ReactElement } from "react";
import { Box, Card, CardContent, Stack, Typography, useTheme } from "@mui/material";
import { LineChart } from "@mui/x-charts/LineChart";
import type { AnalyticsPerDayEntry } from "@/api/types";

const CHART_HEIGHT = 220;

interface ApplicationsTimelineChartProps {
  data: AnalyticsPerDayEntry[];
  title?: string;
  metricLabel?: string;
  emptyMessage?: string;
}

function formatTick(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function ApplicationsTimelineChart(props: ApplicationsTimelineChartProps): ReactElement {
  const {
    data,
    title = "Applications over time",
    metricLabel = "submitted",
    emptyMessage = "No applications submitted yet.",
  } = props;
  const theme = useTheme();

  const yData = data.map((d) => d.count);
  const xData = data.map((d) => d.date);
  const total = yData.reduce((a, b) => a + b, 0);
  const yMax = Math.max(...yData, 1);

  return (
    <Card sx={{ height: "100%" }}>
      <CardContent>
        <Typography variant="overlineMuted">{title}</Typography>
        <Typography variant="h5" sx={{ mt: 0.5 }}>
          {total} {metricLabel} in the last 30 days
        </Typography>

        {total === 0 ? (
          <Stack
            sx={(t) => ({
              mt: 2,
              flex: 1,
              minHeight: CHART_HEIGHT,
              alignItems: "center",
              justifyContent: "center",
              color: t.palette.text.disabled,
            })}
          >
            <Typography variant="captionMuted">{emptyMessage}</Typography>
          </Stack>
        ) : (
          <Box sx={{ mt: 1, flex: 1 }}>
            <LineChart
              xAxis={[
                {
                  data: xData,
                  scaleType: "point",
                  valueFormatter: formatTick,
                  tickLabelStyle: { fontSize: 10 },
                },
              ]}
              yAxis={[
                {
                  min: 0,
                  max: yMax,
                  tickMinStep: 1,
                  tickLabelStyle: { fontSize: 10 },
                },
              ]}
              series={[
                {
                  data: yData,
                  color: theme.palette.accent.primary,
                  area: true,
                  showMark: false,
                  curve: "monotoneX",
                },
              ]}
              height={CHART_HEIGHT}
              margin={{ left: 28, right: 12, top: 12, bottom: 28 }}
              grid={{ horizontal: true }}
            />
          </Box>
        )}
      </CardContent>
    </Card>
  );
}
