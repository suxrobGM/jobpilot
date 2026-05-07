"use client";

import { Box, LinearProgress, Stack, Typography } from "@mui/material";
import type { ReactElement } from "react";
import { SectionCard } from "@/components/ui/layout/section-card";
import { STAGES, type Stage } from "@/lib/schemas/application";
import type { DashboardStats } from "@/types/api";

const STAGE_LABEL: Record<Stage, string> = {
  applied: "Applied",
  recruiter_screen: "Recruiter screen",
  assessment: "Assessment",
  hiring_manager_screen: "HM screen",
  technical_interview: "Technical",
  onsite: "Onsite",
  offer: "Offer",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};

interface FunnelChartProps {
  stats: DashboardStats;
}

export function FunnelChart(props: FunnelChartProps): ReactElement {
  const { stats } = props;
  const max = Math.max(...STAGES.map((s) => stats.byStage[s]), 1);

  return (
    <SectionCard title="Funnel" description="Applications by current stage.">
      <Stack spacing={1}>
        {STAGES.map((stage) => {
          const count = stats.byStage[stage];
          return (
            <Box key={stage}>
              <Stack
                direction="row"
                sx={{ mb: 0.5, alignItems: "center", justifyContent: "space-between" }}
              >
                <Typography variant="body2">{STAGE_LABEL[stage]}</Typography>
                <Typography variant="captionMuted">{count}</Typography>
              </Stack>
              <LinearProgress
                variant="determinate"
                value={(count / max) * 100}
                sx={{ height: 6, borderRadius: 3 }}
              />
            </Box>
          );
        })}
      </Stack>
    </SectionCard>
  );
}
