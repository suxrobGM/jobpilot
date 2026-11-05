"use client";

import type { ReactElement } from "react";
import { TravelExplore } from "@mui/icons-material";
import { Button, Stack, Typography } from "@mui/material";
import type { Route } from "next";
import { api } from "@/api/client";
import { useApiMutation, useApiQuery } from "@/api/hooks";
import { pilotQueries } from "@/api/queries";
import { queryKeys } from "@/api/query-keys";
import type { ResearchStatusDto } from "@/api/types";
import { isRunPending } from "@/components/features/pilot/job-alerts/use-job-alerts";
import { LinkButton } from "@/components/ui/buttons";
import { QuerySection } from "@/components/ui/data";
import { formatRelativeTime } from "@/utils/format";

function lastRunText(status: ResearchStatusDto): string {
  const { lastRun } = status;
  if (status.requestedAt) return "Queued - the pilot picks it up on its next cycle.";
  if (!lastRun) return "No research run yet.";
  const ago = `${formatRelativeTime(lastRun.startedAt)} ago`;
  if (lastRun.outcome === null) return `Researching now - started ${ago}.`;
  return lastRun.summary ? `${ago}: ${lastRun.summary}` : `Last run ${ago}.`;
}

export function ResearchSection(): ReactElement {
  const query = useApiQuery(pilotQueries.research(), {
    errorMessage: "Failed to load research status",
  });
  const run = useApiMutation(() => api.pilot.research.runs.post(), {
    invalidate: [queryKeys.pilot.research(), queryKeys.pilot.taskList()],
    successMessage: "Research queued - the pilot picks it up on its next cycle.",
  });
  const status = query.data;

  return (
    <QuerySection
      isLoading={query.isLoading}
      isError={query.isError}
      onRetry={() => void query.refetch()}
      errorTitle="Couldn't load research status."
      isEmpty={false}
      empty={null}
    >
      {status && (
        <Stack spacing={1}>
          <Typography variant="captionMuted">{lastRunText(status)}</Typography>
          <Stack direction="row" spacing={1}>
            <Button
              size="small"
              variant="outlined"
              startIcon={<TravelExplore />}
              disabled={isRunPending(status) || run.isPending}
              onClick={() => run.mutate()}
            >
              Research now
            </Button>
            {status.campaignId && (
              <LinkButton
                size="small"
                href={`/campaigns/${encodeURIComponent(status.campaignId)}` as Route}
              >
                Research campaign
              </LinkButton>
            )}
          </Stack>
        </Stack>
      )}
    </QuerySection>
  );
}
