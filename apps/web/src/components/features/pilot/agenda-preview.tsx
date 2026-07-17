"use client";

import type { ReactElement, ReactNode } from "react";
import type { AgendaItem } from "@jobpilot/contracts/pilot";
import { Refresh } from "@mui/icons-material";
import {
  Box,
  Button,
  Chip,
  Divider,
  IconButton,
  LinearProgress,
  Stack,
  Typography,
} from "@mui/material";
import { useApiQuery } from "@/api/hooks";
import { pilotQueries } from "@/api/queries";
import { EmptyState } from "@/components/ui/data";
import { SectionCard } from "@/components/ui/layout";
import { formatRelativeTime, formatTimeUntil } from "@/utils/format";

const PREVIEW_COUNT = 6;

/** Required record: a new agenda kind fails typecheck until it gets a label. */
const AGENDA_KIND_LABELS: Record<AgendaItem["kind"], string> = {
  "question.answered": "Act on answered question",
  "job.apply": "Apply to job",
  "search.discover": "Run saved search",
  "campaign.finalize": "Finalize campaign",
  "inbox.review": "Review inbox email",
  "outreach.send": "Send outreach",
  "outreach.followup": "Follow up on outreach",
  "outreach.warmIntro": "Ask for a warm intro",
  "promo.compose": "Draft promotion post",
  "promo.post": "Publish promotion post",
  "interview.reply": "Reply about an interview",
  "interview.prep": "Prepare interview notes",
  "queue.drain": "Drain apply queue",
  "board.health": "Board health check",
  "campaign.strategyReview": "Review campaign strategy",
  "job.rescanSkipped": "Rescan skipped jobs",
  "job.retryFailed": "Retry failed jobs",
};

/** Read-only peek at the next cycle's plan. Fetched once + manual refresh: agenda compiles are costly. */
export function AgendaPreview(): ReactElement {
  const query = useApiQuery(pilotQueries.agenda(), {
    staleTime: Number.POSITIVE_INFINITY,
    refetchOnWindowFocus: false,
    retry: false,
  });

  let body: ReactNode;
  if (query.isLoading) {
    body = <LinearProgress />;
  } else if (query.isError || !query.data) {
    body = (
      <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
        <Typography variant="body2Muted">Couldn't load the agenda.</Typography>
        <Button variant="text" size="small" onClick={() => void query.refetch()}>
          Retry
        </Button>
      </Stack>
    );
  } else {
    const { items, generatedAt, nextWakeAt } = query.data;
    const visible = items.slice(0, PREVIEW_COUNT);
    body = (
      <Stack spacing={2}>
        {visible.length === 0 ? (
          <EmptyState variant="inline" title="Agenda is clear." />
        ) : (
          <Stack spacing={1.5} divider={<Divider />}>
            {visible.map((item, index) => (
              <Stack key={item.id} direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
                <Typography variant="overlineMuted" sx={{ width: 16, flexShrink: 0 }}>
                  {index + 1}
                </Typography>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="captionMuted">{AGENDA_KIND_LABELS[item.kind]}</Typography>
                  <Typography variant="body2" noWrap>
                    {item.title}
                  </Typography>
                </Box>
                <Chip size="small" variant="outlined" label={item.subjectType} />
              </Stack>
            ))}
          </Stack>
        )}
        {items.length > PREVIEW_COUNT && (
          <Typography variant="captionMuted">+{items.length - PREVIEW_COUNT} more</Typography>
        )}
        <Typography variant="captionMuted">
          Compiled {formatRelativeTime(generatedAt)} ago · next wake in{" "}
          {formatTimeUntil(nextWakeAt)}
        </Typography>
      </Stack>
    );
  }

  return (
    <SectionCard
      title="Up next"
      description="What the pilot plans to work on next cycle."
      actions={
        <IconButton
          aria-label="Refresh agenda"
          disabled={query.isFetching}
          onClick={() => void query.refetch()}
        >
          <Refresh fontSize="sm" />
        </IconButton>
      }
    >
      {body}
    </SectionCard>
  );
}
