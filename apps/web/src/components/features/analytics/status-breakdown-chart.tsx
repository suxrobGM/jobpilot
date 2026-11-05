"use client";

import type { ReactElement } from "react";
import { useTheme } from "@mui/material";
import { PieChart } from "@mui/x-charts/PieChart";
import type { AnalyticsStatusBreakdownEntry } from "@/api/types";
import { ChartEmpty } from "@/components/ui/data";
import { statusChartColor, statusLabel } from "@/components/ui/display";
import { SectionCard } from "@/components/ui/layout";

const CHART_HEIGHT = 220;

interface StatusBreakdownChartProps {
  data: AnalyticsStatusBreakdownEntry[];
}

export function StatusBreakdownChart(props: StatusBreakdownChartProps): ReactElement {
  const { data } = props;
  const theme = useTheme();

  const series = data
    .filter((d) => d.count > 0)
    .map((d) => ({
      id: d.status,
      label: statusLabel("application", d.status),
      value: d.count,
      color: statusChartColor(theme, "application", d.status),
    }));

  const total = series.reduce((sum, s) => sum + s.value, 0);

  return (
    <SectionCard eyebrow="Status breakdown" title={`${total} applications by status`} fullHeight>
      {series.length === 0 ? (
        <ChartEmpty message="No applications yet." height={CHART_HEIGHT} />
      ) : (
        <PieChart
          series={[
            {
              data: series,
              innerRadius: 48,
              paddingAngle: 1.5,
              cornerRadius: 2,
              highlightScope: { fade: "global", highlight: "item" },
            },
          ]}
          height={CHART_HEIGHT}
          slotProps={{
            legend: {
              direction: "vertical",
              position: { vertical: "middle", horizontal: "end" },
            },
          }}
        />
      )}
    </SectionCard>
  );
}
