"use client";

import type { ReactElement } from "react";
import { Box, LinearProgress, Stack, Typography } from "@mui/material";
import { useApiQuery } from "@/api/hooks";
import { pilotQueries } from "@/api/queries";
import { EmptyState, QuerySection } from "@/components/ui/data";
import { SectionCard } from "@/components/ui/layout";
import { formatDuration, plural } from "@/utils/format";
import { agendaKindLabel } from "../agenda-kinds";

/**
 * Where the week's cycles went, by agenda kind. Wall clock stands in for token spend: the two track
 * each other closely enough to rank the kinds, and nothing measures tokens per cycle today.
 */
export function CycleCost(): ReactElement {
  const query = useApiQuery(pilotQueries.cost(), { errorMessage: "Failed to load cycle costs" });
  const items = query.data?.items ?? [];
  const heaviest = items[0]?.totalMs ?? 0;

  return (
    <SectionCard
      title="Where the time goes"
      description="The last 7 days of cycles by agenda kind, heaviest first."
    >
      <QuerySection
        isLoading={query.isLoading}
        isError={query.isError}
        onRetry={() => void query.refetch()}
        errorTitle="Couldn't load cycle costs."
        isEmpty={items.length === 0}
        empty={<EmptyState variant="inline" title="No finished cycles in the last 7 days." />}
      >
        <Stack spacing={1.5}>
          {items.map((item) => (
            <Box key={item.kind}>
              <Stack
                direction="row"
                spacing={1}
                sx={{ alignItems: "baseline", justifyContent: "space-between" }}
              >
                <Typography variant="body2">{agendaKindLabel(item.kind)}</Typography>
                <Typography variant="captionMuted">
                  {formatDuration(Math.round(item.totalMs / 1000))} total
                </Typography>
              </Stack>
              <LinearProgress
                variant="determinate"
                value={heaviest > 0 ? (item.totalMs / heaviest) * 100 : 0}
                sx={{ my: 0.5 }}
              />
              <Typography variant="captionMuted">
                {plural(item.runs, "run")} · {formatDuration(Math.round(item.medianMs / 1000))}{" "}
                typical
                {item.failed > 0 && ` · ${item.failed} failed`}
                {item.abandoned > 0 && ` · ${item.abandoned} abandoned`}
              </Typography>
            </Box>
          ))}
        </Stack>
      </QuerySection>
    </SectionCard>
  );
}
