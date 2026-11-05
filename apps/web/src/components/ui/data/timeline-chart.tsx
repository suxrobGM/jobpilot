"use client";

import type { ReactElement } from "react";
import { useTheme } from "@mui/material";
import { LineChart } from "@mui/x-charts/LineChart";
import type { AnalyticsPerDayEntry } from "@/api/types";
import { SectionCard } from "@/components/ui/layout";
import { formatDayBucket } from "@/utils/format";
import { ChartEmpty } from "./chart-empty";

const CHART_HEIGHT = 220;

interface TimelineChartProps {
  data: AnalyticsPerDayEntry[];
  eyebrow: string;
  /** What one count is, in "N {metricLabel} in the last 30 days". */
  metricLabel: string;
  emptyMessage: string;
}

/** A 30-day daily count as an area line, in its own card. */
export function TimelineChart(props: TimelineChartProps): ReactElement {
  const { data, eyebrow, metricLabel, emptyMessage } = props;
  const theme = useTheme();

  const yData = data.map((d) => d.count);
  const total = yData.reduce((a, b) => a + b, 0);

  return (
    <SectionCard eyebrow={eyebrow} title={`${total} ${metricLabel} in the last 30 days`} fullHeight>
      {total === 0 ? (
        <ChartEmpty message={emptyMessage} height={CHART_HEIGHT} />
      ) : (
        <LineChart
          xAxis={[
            {
              data: data.map((d) => d.date),
              scaleType: "point",
              valueFormatter: formatDayBucket,
              tickLabelStyle: { fontSize: 10 },
            },
          ]}
          yAxis={[
            {
              min: 0,
              max: Math.max(...yData, 1),
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
      )}
    </SectionCard>
  );
}
