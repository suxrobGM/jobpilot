"use client";

import type { ReactElement } from "react";
import { Box, Card, CardContent, Stack, Typography, useTheme } from "@mui/material";
import { PieChart } from "@mui/x-charts/PieChart";
import type { AnalyticsStageBreakdownEntry } from "@/api/types";

const CHART_HEIGHT = 220;

const STAGE_LABEL: Record<string, string> = {
  applied: "Applied",
  recruiter_screen: "Recruiter screen",
  assessment: "Assessment",
  hiring_manager_screen: "Hiring manager screen",
  technical_interview: "Technical interview",
  onsite: "Onsite",
  offer: "Offer",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};

interface StageBreakdownChartProps {
  data: AnalyticsStageBreakdownEntry[];
}

export function StageBreakdownChart(props: StageBreakdownChartProps): ReactElement {
  const { data } = props;
  const theme = useTheme();

  const colors = [
    theme.palette.stages.submitted,
    theme.palette.info.main,
    theme.palette.stages.queued,
    theme.palette.accent.primary,
    theme.palette.warning.main,
    theme.palette.stages.interviewing,
    theme.palette.success.main,
    theme.palette.error.main,
    theme.palette.text.disabled,
  ];

  const series = data
    .filter((d) => d.count > 0)
    .map((d, i) => ({
      id: d.stage,
      label: STAGE_LABEL[d.stage] ?? d.stage,
      value: d.count,
      color: colors[i % colors.length],
    }));

  const total = series.reduce((sum, s) => sum + s.value, 0);

  return (
    <Card sx={{ height: "100%" }}>
      <CardContent>
        <Typography variant="overlineMuted">Stage breakdown</Typography>
        <Typography variant="h5" sx={{ mt: 0.5 }}>
          {total} applications by stage
        </Typography>

        {series.length === 0 ? (
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
            <Typography variant="captionMuted">No applications yet.</Typography>
          </Stack>
        ) : (
          <Box sx={{ mt: 1, flex: 1 }}>
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
          </Box>
        )}
      </CardContent>
    </Card>
  );
}
