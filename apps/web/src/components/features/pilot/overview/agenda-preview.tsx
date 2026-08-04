"use client";

import type { ReactElement } from "react";
import type { AgendaItem, AgendaResponse } from "@jobpilot/contracts/pilot";
import { Refresh } from "@mui/icons-material";
import { Box, Chip, Divider, IconButton, Stack, Typography } from "@mui/material";
import { api } from "@/api/client";
import { useApiMutation, useApiQuery } from "@/api/hooks";
import { pilotQueries } from "@/api/queries";
import { queryKeys } from "@/api/query-keys";
import { LinkButton } from "@/components/ui/buttons";
import { EmptyState, QuerySection } from "@/components/ui/data";
import { SectionCard } from "@/components/ui/layout";
import { formatRelativeTime, formatTimeUntil } from "@/utils/format";

const PREVIEW_COUNT = 6;

/** Required record: a new agenda kind fails typecheck until it gets a label. */
const AGENDA_KIND_LABELS: Record<AgendaItem["kind"], string> = {
  "question.answered": "Act on answered question",
  "job.apply": "Apply to job",
  "search.discover": "Run saved search",
  "campaign.scorePending": "Score discovered jobs",
  "campaign.reviewPaused": "Review paused campaign",
  "inbox.review": "Review inbox email",
  "networking.send": "Send networking message",
  "networking.followup": "Follow up on networking message",
  "networking.warmIntro": "Ask for a warm intro",
  "promo.compose": "Draft promotion post",
  "promo.post": "Publish promotion post",
  "interview.reply": "Reply about an interview",
  "interview.prep": "Prepare interview notes",
  "queue.drain": "Score pasted links",
  "board.health": "Board health check",
  "campaign.strategyReview": "Review campaign strategy",
  "job.rescanSkipped": "Rescan skipped jobs",
  "job.retryFailed": "Retry failed jobs",
  "strategy.bootstrap": "Set up goals and saved searches",
};

interface AgendaEmptyProps {
  reason: AgendaResponse["emptyReason"];
  budget: AgendaResponse["budget"];
}

/** Explains an empty agenda; the reason is decided server-side (see AgendaResponse.emptyReason). */
function AgendaEmpty(props: AgendaEmptyProps): ReactElement {
  const { reason, budget } = props;
  if (reason === "capReached") {
    return (
      <EmptyState
        variant="inline"
        title="Daily cap reached."
        description={`Applied ${budget.appliedToday}/${budget.dailyApplyCap} - resets in ${formatTimeUntil(budget.resetsAt)}.`}
      />
    );
  }
  if (reason === "awaitingSetup") {
    return (
      <EmptyState
        variant="inline"
        title="Getting set up."
        description="The pilot derives goals and saved searches from your profile - this finishes on an upcoming cycle."
        action={
          <LinkButton size="small" href="/pilot/instructions">
            Edit instructions
          </LinkButton>
        }
      />
    );
  }
  // No description: the card's footer already carries the next-wake countdown.
  return <EmptyState variant="inline" title="Agenda is clear." />;
}

/** Read-only peek at the next cycle's plan. Fetched once + manual refresh: agenda compiles are costly. */
export function AgendaPreview(): ReactElement {
  const query = useApiQuery(pilotQueries.agenda(), {
    staleTime: Number.POSITIVE_INFINITY,
    refetchOnWindowFocus: false,
    retry: false,
  });
  const refresh = useApiMutation<AgendaResponse, void>(() => api.pilot.agenda.refresh.post(), {
    invalidate: [queryKeys.pilot.agenda()],
  });

  const agenda = query.data;
  const visible = agenda?.items.slice(0, PREVIEW_COUNT) ?? [];

  return (
    <SectionCard
      title="Up next"
      description="What the pilot plans to work on next cycle."
      actions={
        <IconButton
          aria-label="Refresh agenda"
          disabled={query.isFetching || refresh.isPending}
          onClick={() => refresh.mutate()}
        >
          <Refresh fontSize="sm" />
        </IconButton>
      }
    >
      <QuerySection
        isLoading={query.isLoading}
        isError={query.isError}
        onRetry={() => void query.refetch()}
        errorTitle="Couldn't load the agenda."
        isEmpty={!agenda}
        empty={
          <EmptyState
            variant="inline"
            title="No current agenda snapshot."
            description="Refresh to compile the pilot's next versioned agenda."
          />
        }
      >
        {agenda && (
          <Stack spacing={2}>
            {visible.length === 0 ? (
              <AgendaEmpty reason={agenda.emptyReason} budget={agenda.budget} />
            ) : (
              <Stack spacing={1.5} divider={<Divider />}>
                {visible.map((item, index) => (
                  <Stack key={item.id} direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
                    <Typography variant="overlineMuted" sx={{ width: 16, flexShrink: 0 }}>
                      {index + 1}
                    </Typography>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="captionMuted">
                        {AGENDA_KIND_LABELS[item.kind]}
                      </Typography>
                      <Typography variant="body2" noWrap>
                        {item.title}
                      </Typography>
                    </Box>
                    <Chip size="small" variant="outlined" label={item.subjectType} />
                  </Stack>
                ))}
              </Stack>
            )}
            {agenda.items.length > PREVIEW_COUNT && (
              <Typography variant="captionMuted">
                +{agenda.items.length - PREVIEW_COUNT} more
              </Typography>
            )}
            <Typography variant="captionMuted">
              Compiled {formatRelativeTime(agenda.generatedAt)} ago · next wake in{" "}
              {formatTimeUntil(agenda.nextWakeAt)}
            </Typography>
          </Stack>
        )}
      </QuerySection>
    </SectionCard>
  );
}
