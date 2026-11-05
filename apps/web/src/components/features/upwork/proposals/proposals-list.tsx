"use client";

import { type ReactElement, useState } from "react";
import { upworkChannel } from "@jobpilot/contracts/sse";
import type { UpworkProposalStatus } from "@jobpilot/contracts/upwork";
import { ChevronRight, Clear } from "@mui/icons-material";
import { Box, Button, Card, CardActionArea, Chip, Stack, Typography } from "@mui/material";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Route } from "next";
import { upworkProposalQueries } from "@/api/queries";
import { PaginationFooter } from "@/components/ui/data";
import { RelativeTime, StatusChip, statusOptions } from "@/components/ui/display";
import { EmptyState } from "@/components/ui/feedback";
import { SelectField } from "@/components/ui/form";
import { SectionCard } from "@/components/ui/layout";
import { usePaginationParams } from "@/hooks/use-pagination";
import { useSseChannel } from "@/lib/sse/client";
import { plural } from "@/utils/format";

const PAGE_SIZE = 10;

export function ProposalsList(): ReactElement {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<UpworkProposalStatus | null>(null);
  const { query, setPage, setPageSize } = usePaginationParams({ pageSize: PAGE_SIZE });

  const invalidate = (): void => {
    queryClient.invalidateQueries({ queryKey: upworkProposalQueries.all });
  };
  useSseChannel(upworkChannel, null, {
    on: {
      "proposal.created": invalidate,
      "proposal.updated": invalidate,
      "proposal.deleted": invalidate,
    },
  });

  const proposals = useQuery(
    upworkProposalQueries.list({ ...query, ...(statusFilter && { status: statusFilter }) }),
  );

  const pageRows = proposals.data?.items ?? [];
  const total = proposals.data?.pagination.total ?? 0;
  const hasFilters = statusFilter !== null;

  return (
    <SectionCard>
      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={1.5}
        sx={{ alignItems: { xs: "stretch", md: "center" }, mb: 2 }}
      >
        <SelectField
          label="Status"
          value={statusFilter}
          options={statusOptions("upworkProposal")}
          onChange={(v) => {
            setStatusFilter(v);
            setPage(1);
          }}
        />
        {hasFilters && (
          <Button
            size="small"
            variant="text"
            startIcon={<Clear fontSize="sm" />}
            onClick={() => {
              setStatusFilter(null);
              setPage(1);
            }}
          >
            Clear
          </Button>
        )}
        <Box sx={{ flex: 1 }} />
        <Typography variant="captionMuted">{plural(total, "proposal")}</Typography>
      </Stack>

      {pageRows.length === 0 ? (
        <EmptyState
          variant="inline"
          title={
            hasFilters
              ? "No proposals match the current filter."
              : "No proposals yet. Start one from “New proposal”."
          }
        />
      ) : (
        <Stack spacing={1}>
          {pageRows.map((p) => (
            <Card key={p.id} variant="interactive">
              <CardActionArea href={`/upwork/${p.id}` as Route} sx={{ padding: 1.5 }}>
                <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
                  <Stack spacing={0.5} sx={{ flex: 1, minWidth: 0 }}>
                    <Stack
                      direction="row"
                      spacing={1}
                      sx={{ alignItems: "center", flexWrap: "wrap" }}
                    >
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
        </Stack>
      )}

      {proposals.data && (
        <PaginationFooter
          pagination={proposals.data.pagination}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      )}
    </SectionCard>
  );
}
