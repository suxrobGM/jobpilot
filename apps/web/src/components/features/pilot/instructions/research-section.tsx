"use client";

import type { ReactElement } from "react";
import { TravelExplore } from "@mui/icons-material";
import { Button, Stack, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import { pilotQueries } from "@/api/queries";
import type { ResearchStatusDto } from "@/api/types";
import { useApiMutation } from "@/api/use-api-mutation";
import { LinkButton } from "@/components/ui/buttons";
import { QuerySection } from "@/components/ui/feedback";
import { formatRelativeTime } from "@/utils/format";
import { campaignHref } from "@/utils/routes";
import { isRunPending } from "../run-status";

function lastRunText(status: ResearchStatusDto): string {
  const { lastRun } = status;
  if (status.requestedAt) {
    return "Queued - the pilot picks it up on its next cycle.";
  }
  if (!lastRun) {
    return "No research run yet.";
  }
  const ago = `${formatRelativeTime(lastRun.startedAt)} ago`;
  if (lastRun.outcome === null) {
    return `Researching now - started ${ago}.`;
  }
  return lastRun.summary ? `${ago}: ${lastRun.summary}` : `Last run ${ago}.`;
}

export function ResearchSection(): ReactElement {
  const query = useQuery(pilotQueries.research());
  const run = useApiMutation(() => api.pilot.research.runs.post(), {
    invalidate: [pilotQueries.research().queryKey, pilotQueries.taskList().queryKey],
    successMessage: "Research queued - the pilot picks it up on its next cycle.",
  });
  const status = query.data;

  return (
    <QuerySection
      query={query}
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
              <LinkButton size="small" href={campaignHref(status.campaignId)}>
                Research campaign
              </LinkButton>
            )}
          </Stack>
        </Stack>
      )}
    </QuerySection>
  );
}
