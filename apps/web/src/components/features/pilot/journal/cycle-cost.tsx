"use client";

import type { ReactElement } from "react";
import { newTokens, taskTypeLabel } from "@jobpilot/contracts/pilot";
import { Box, LinearProgress, Stack, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { pilotQueries } from "@/api/queries";
import { EmptyState, QuerySection } from "@/components/ui/feedback";
import { SectionCard } from "@/components/ui/layout";
import { formatNewTokenParts, formatTokenSplit, formatTokens, plural } from "@/utils/format";

export function CycleCost(): ReactElement {
  const query = useQuery(pilotQueries.cost());
  const items = query.data?.items ?? [];
  const heaviest = items.length > 0 ? newTokens(items[0].tokens) : 0;

  return (
    <SectionCard
      title="Where the tokens go"
      description="The last 7 days of runs by task type, most new tokens first. Cached tokens are cheap re-reads of context."
    >
      <QuerySection
        query={query}
        errorTitle="Couldn't load cycle costs."
        isEmpty={items.length === 0}
        empty={<EmptyState variant="inline" title="No finished cycles in the last 7 days." />}
      >
        <Stack spacing={1.5}>
          {items.map((item) => (
            <Box key={item.taskType}>
              <Stack
                direction="row"
                spacing={1}
                sx={{ alignItems: "baseline", justifyContent: "space-between" }}
              >
                <Typography variant="body2">{taskTypeLabel(item.taskType)}</Typography>
                <Typography variant="captionMuted">{formatTokenSplit(item.tokens)}</Typography>
              </Stack>
              <LinearProgress
                variant="determinate"
                value={heaviest > 0 ? (newTokens(item.tokens) / heaviest) * 100 : 0}
                sx={{ my: 0.5 }}
              />
              <Stack>
                <Typography variant="captionMuted">{formatNewTokenParts(item.tokens)}</Typography>
                <Typography variant="captionMuted">
                  {plural(item.runs, "run")} · {formatTokens(item.medianNewTokens)} typical
                  {item.failed > 0 && ` · ${item.failed} failed`}
                  {item.unfinished > 0 && ` · ${item.unfinished} unfinished`}
                </Typography>
              </Stack>
            </Box>
          ))}
        </Stack>
      </QuerySection>
    </SectionCard>
  );
}
