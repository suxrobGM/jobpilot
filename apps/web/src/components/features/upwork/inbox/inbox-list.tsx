"use client";

import { type ReactElement, useState } from "react";
import { upworkChannel } from "@jobpilot/contracts/sse";
import type { UpworkInboxKind, UpworkInboxStatus } from "@jobpilot/contracts/upwork";
import { Clear, CloudSync, Launch } from "@mui/icons-material";
import { Box, Button, Card, Chip, Stack, Typography } from "@mui/material";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { useApiMutation, useApiQuery } from "@/api/hooks";
import { upworkInboxQueries } from "@/api/queries";
import { queryKeys } from "@/api/query-keys";
import type { UpworkInboxItemDto } from "@/api/types";
import { AgentOnlyButton } from "@/components/ui/buttons";
import { EmptyState, PaginationFooter } from "@/components/ui/data";
import { ColorChip } from "@/components/ui/display";
import { SelectField } from "@/components/ui/form";
import { SectionCard } from "@/components/ui/layout";
import { usePaginationParams } from "@/hooks/use-pagination";
import { useSseChannel } from "@/lib/sse/client";
import { useAgent, useAgentAvailable } from "@/providers/agent-provider";
import { formatRelativeTime, plural } from "@/utils/format";
import { INBOX_STATUS_OPTIONS, KIND_COLOR, KIND_LABEL, KIND_OPTIONS } from "./inbox-kind";

const PAGE_SIZE = 10;

export function InboxList(): ReactElement {
  const queryClient = useQueryClient();
  const agent = useAgent();
  const [kindFilter, setKindFilter] = useState<UpworkInboxKind | null>(null);
  const [statusFilter, setStatusFilter] = useState<UpworkInboxStatus | null>(null);
  const { query, setPage, setPageSize } = usePaginationParams({ pageSize: PAGE_SIZE });

  const invalidate = (): void => {
    queryClient.invalidateQueries({ queryKey: queryKeys.upworkInbox.all });
  };
  useSseChannel(upworkChannel, null, {
    on: { "inbox.synced": invalidate, "inbox.updated": invalidate },
  });

  const inbox = useApiQuery(
    upworkInboxQueries.list({
      ...query,
      ...(kindFilter && { kind: kindFilter }),
      ...(statusFilter && { status: statusFilter }),
    }),
  );

  const setStatus = useApiMutation<UpworkInboxItemDto, { id: string; status: UpworkInboxStatus }>(
    ({ id, status }) => api.upwork.inbox({ id }).patch({ status }),
    { invalidate: [queryKeys.upworkInbox.all] },
  );

  const pageRows = inbox.data?.items ?? [];
  const total = inbox.data?.pagination.total ?? 0;
  const hasFilters = kindFilter !== null || statusFilter !== null;

  return (
    <SectionCard>
      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={1.5}
        sx={{ alignItems: { xs: "stretch", md: "center" }, mb: 2 }}
      >
        <SelectField
          label="Kind"
          value={kindFilter}
          options={KIND_OPTIONS}
          onChange={(v) => {
            setKindFilter(v);
            setPage(1);
          }}
        />
        <SelectField
          label="Status"
          value={statusFilter}
          options={INBOX_STATUS_OPTIONS}
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
              setKindFilter(null);
              setStatusFilter(null);
              setPage(1);
            }}
          >
            Clear
          </Button>
        )}
        <Box sx={{ flex: 1 }} />
        <Typography variant="captionMuted">{plural(total, "item")}</Typography>
        <AgentOnlyButton
          size="small"
          variant="outlined"
          startIcon={<CloudSync fontSize="sm" />}
          onClick={() => void agent.injectSkill("upwork-sync")}
          tooltip="Run the upwork-sync skill to mirror invitations, offers and messages"
        >
          Sync
        </AgentOnlyButton>
      </Stack>

      {pageRows.length === 0 ? (
        <InboxEmptyState hasFilters={hasFilters} />
      ) : (
        <Stack spacing={1}>
          {pageRows.map((item) => (
            <Card key={item.id} sx={{ padding: 1.5 }}>
              <Stack spacing={0.5}>
                <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}>
                  <ColorChip
                    value={item.kind}
                    colors={KIND_COLOR}
                    label={KIND_LABEL[item.kind]}
                    variant={item.status === "unread" ? "filled" : "outlined"}
                  />
                  {item.clientName && (
                    <Chip size="small" label={item.clientName} variant="outlined" />
                  )}
                  <Box sx={{ flex: 1 }} />
                  {item.jobUrl && (
                    <Button
                      size="small"
                      startIcon={<Launch fontSize="sm" />}
                      component="a"
                      href={item.jobUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Open
                    </Button>
                  )}
                  {item.status !== "archived" && (
                    <Button
                      size="small"
                      variant="text"
                      onClick={() => setStatus.mutate({ id: item.id, status: "archived" })}
                    >
                      Archive
                    </Button>
                  )}
                </Stack>
                <Typography variant="body2Strong">{item.title}</Typography>
                {item.body && (
                  <Typography variant="body2" color="text.secondary">
                    {item.body}
                  </Typography>
                )}
                <Typography variant="captionMuted">
                  Received {formatRelativeTime(item.receivedAt)}
                </Typography>
              </Stack>
            </Card>
          ))}
        </Stack>
      )}

      {inbox.data && (
        <PaginationFooter
          pagination={inbox.data.pagination}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      )}
    </SectionCard>
  );
}

interface InboxEmptyStateProps {
  hasFilters: boolean;
}

/** Owns the breakpoint read so a resize does not re-render the whole list. */
function InboxEmptyState(props: InboxEmptyStateProps): ReactElement {
  const { hasFilters } = props;
  const agentAvailable = useAgentAvailable();

  if (hasFilters) {
    return <EmptyState variant="inline" title="No items match the current filter." />;
  }
  return (
    <EmptyState
      variant="inline"
      title="Nothing here yet."
      description={
        agentAvailable
          ? "Run Sync to pull your invitations, offers and messages from Upwork."
          : "Open JobPilot on your desktop to sync your Upwork inbox."
      }
    />
  );
}
