"use client";

import type { ReactElement } from "react";
import { upworkChannel } from "@jobpilot/contracts/sse";
import {
  UPWORK_INBOX_KINDS,
  UPWORK_INBOX_STATUSES,
  type UpworkInboxStatus,
} from "@jobpilot/contracts/upwork";
import { CloudSync, Launch } from "@mui/icons-material";
import { Box, Button, Card, CardContent, Chip, Stack, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { api } from "@/api/client";
import { upworkInboxQueries } from "@/api/queries";
import { useApiMutation } from "@/api/use-api-mutation";
import { AgentOnlyButton } from "@/components/ui/buttons";
import { RelativeTime, StatusChip, statusOptions } from "@/components/ui/display";
import { EmptyState } from "@/components/ui/feedback";
import { FilterToggle } from "@/components/ui/form";
import { useLiveInvalidation } from "@/hooks/use-live-invalidation";
import { usePaginationParams } from "@/hooks/use-pagination";
import { useAgent, useAgentAvailable } from "@/providers/agent-provider";
import { plural } from "@/utils/format";
import { enumParam } from "@/utils/search-params";
import { UPWORK_PAGE_SIZE, UpworkListFrame } from "../upwork-list-frame";

const KIND_OPTIONS = statusOptions("upworkInboxKind");
const INBOX_STATUS_OPTIONS = statusOptions("upworkInboxStatus");

interface InboxStatusChange {
  id: string;
  status: UpworkInboxStatus;
}

export function InboxList(): ReactElement {
  const agent = useAgent();
  const params = useSearchParams();
  const kind = enumParam(UPWORK_INBOX_KINDS, params.get("kind"));
  const status = enumParam(UPWORK_INBOX_STATUSES, params.get("status"));
  const pager = usePaginationParams({ pageSize: UPWORK_PAGE_SIZE });
  const { query, setFilters } = pager;

  useLiveInvalidation(upworkChannel, null, {
    on: { "inbox.synced": [upworkInboxQueries.all], "inbox.updated": [upworkInboxQueries.all] },
  });

  const inbox = useQuery(
    upworkInboxQueries.list({ ...query, ...(kind && { kind }), ...(status && { status }) }),
  );

  const setStatus = useApiMutation(
    (change: InboxStatusChange) =>
      api.upwork.inbox({ id: change.id }).patch({ status: change.status }),
    { invalidate: [upworkInboxQueries.all] },
  );

  const hasFilters = kind !== null || status !== null;

  return (
    <UpworkListFrame
      filters={
        <>
          <FilterToggle
            label="Kind"
            value={kind}
            options={KIND_OPTIONS}
            onChange={(next) => setFilters({ kind: next })}
          />
          <FilterToggle
            label="Status"
            value={status}
            options={INBOX_STATUS_OPTIONS}
            onChange={(next) => setFilters({ status: next })}
          />
        </>
      }
      hasFilters={hasFilters}
      onClearFilters={() => setFilters({ kind: null, status: null })}
      countLabel={plural(inbox.data?.pagination.total ?? 0, "item")}
      actions={
        <AgentOnlyButton
          size="small"
          variant="outlined"
          startIcon={<CloudSync fontSize="sm" />}
          onClick={() => void agent.injectSkill("upwork-sync")}
          tooltip="Run the upwork-sync skill to mirror invitations, offers and messages"
        >
          Sync
        </AgentOnlyButton>
      }
      query={inbox}
      pager={pager}
      errorTitle="Couldn't load your Upwork inbox."
      empty={<InboxEmptyState hasFilters={hasFilters} />}
    >
      {(inbox.data?.items ?? []).map((item) => (
        <Card key={item.id}>
          <CardContent>
            <Stack spacing={0.5}>
              <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}>
                <StatusChip
                  domain="upworkInboxKind"
                  value={item.kind}
                  variant={item.status === "unread" ? "filled" : "outlined"}
                />
                {item.clientName && <Chip label={item.clientName} variant="outlined" />}
                <Box sx={{ flex: 1 }} />
                {item.jobUrl && (
                  <Button size="small" startIcon={<Launch fontSize="sm" />} href={item.jobUrl}>
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
              {item.body && <Typography variant="body2Muted">{item.body}</Typography>}
              <RelativeTime prefix="Received" value={item.receivedAt} />
            </Stack>
          </CardContent>
        </Card>
      ))}
    </UpworkListFrame>
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
