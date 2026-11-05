"use client";

import type { ReactElement } from "react";
import { upworkChannel } from "@jobpilot/contracts/sse";
import { UPWORK_PROPOSAL_STATUSES } from "@jobpilot/contracts/upwork";
import { ChevronRight } from "@mui/icons-material";
import { Card, CardActionArea, Chip, Stack, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { upworkProposalQueries } from "@/api/queries";
import { RelativeTime, StatusChip, statusOptions } from "@/components/ui/display";
import { EmptyState } from "@/components/ui/feedback";
import { FilterToggle } from "@/components/ui/form";
import { useLiveInvalidation } from "@/hooks/use-live-invalidation";
import { usePaginationParams } from "@/hooks/use-pagination";
import { plural } from "@/utils/format";
import { proposalHref } from "@/utils/routes";
import { enumParam } from "@/utils/search-params";
import { UPWORK_PAGE_SIZE, UpworkListFrame } from "../upwork-list-frame";

const STATUS_OPTIONS = statusOptions("upworkProposal");

export function ProposalsList(): ReactElement {
  const status = enumParam(UPWORK_PROPOSAL_STATUSES, useSearchParams().get("status"));
  const pager = usePaginationParams({ pageSize: UPWORK_PAGE_SIZE });
  const { query, setFilters } = pager;

  useLiveInvalidation(upworkChannel, null, {
    on: {
      "proposal.created": [upworkProposalQueries.all],
      "proposal.updated": [upworkProposalQueries.all],
      "proposal.deleted": [upworkProposalQueries.all],
    },
  });

  const proposals = useQuery(upworkProposalQueries.list({ ...query, ...(status && { status }) }));
  const hasFilters = status !== null;

  return (
    <UpworkListFrame
      filters={
        <FilterToggle
          label="Status"
          value={status}
          options={STATUS_OPTIONS}
          onChange={(next) => setFilters({ status: next })}
        />
      }
      hasFilters={hasFilters}
      onClearFilters={() => setFilters({ status: null })}
      countLabel={plural(proposals.data?.pagination.total ?? 0, "proposal")}
      query={proposals}
      pager={pager}
      errorTitle="Couldn't load your proposals."
      empty={
        <EmptyState
          variant="inline"
          title={
            hasFilters
              ? "No proposals match the current filter."
              : "No proposals yet. Start one from \u201cNew proposal\u201d."
          }
        />
      }
    >
      {(proposals.data?.items ?? []).map((p) => (
        <Card key={p.id} variant="interactive">
          <CardActionArea href={proposalHref(p.id)} sx={{ padding: 1.5 }}>
            <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
              <Stack spacing={0.5} sx={{ flex: 1, minWidth: 0 }}>
                <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}>
                  <StatusChip domain="upworkProposal" value={p.status} />
                  {p.clientName && <Chip label={p.clientName} variant="outlined" />}
                </Stack>
                <Typography variant="body2Strong" noWrap>
                  {p.jobTitle}
                </Typography>
                <Stack direction="row" spacing={0.5}>
                  <RelativeTime prefix="Updated" value={p.updatedAt} />
                  {!p.proposalText && (
                    <Typography variant="captionMuted">· not generated yet</Typography>
                  )}
                </Stack>
              </Stack>
              <ChevronRight fontSize="md" />
            </Stack>
          </CardActionArea>
        </Card>
      ))}
    </UpworkListFrame>
  );
}
