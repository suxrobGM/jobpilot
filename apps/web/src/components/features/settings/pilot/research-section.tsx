"use client";

import type { ReactElement } from "react";
import { TravelExplore } from "@mui/icons-material";
import { Button, Stack, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { pilotQueries } from "@/api/queries";
import type { ResearchStatusDto } from "@/api/types";
import { LinkButton } from "@/components/ui/buttons";
import { QuerySection } from "@/components/ui/feedback";
import { formatRelativeTime } from "@/utils/format";
import { pipelineHref } from "@/utils/routes";
import { useCreateRequest } from "../../pilot/requests/use-create-request";
import { isRunning } from "../../pilot/run-status";

function lastRunText(status: ResearchStatusDto): string {
  const { lastRun } = status;
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
  const request = useCreateRequest();
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
              disabled={isRunning(status)}
              loading={request.isPending}
              onClick={() => request.mutate({ taskType: "research.explore", payload: {} })}
            >
              Research now
            </Button>
            {status.feedId && (
              <LinkButton size="small" href={pipelineHref(status.feedId)}>
                Research feed
              </LinkButton>
            )}
          </Stack>
        </Stack>
      )}
    </QuerySection>
  );
}
