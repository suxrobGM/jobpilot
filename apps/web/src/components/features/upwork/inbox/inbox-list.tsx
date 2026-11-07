"use client";

import type { ReactElement } from "react";
import { upworkChannel } from "@jobpilot/contracts/sse";
import {
  UPWORK_INBOX_KINDS,
  UPWORK_INBOX_STATUSES,
  type UpworkInboxStatus,
} from "@jobpilot/contracts/upwork";
import { ArchiveOutlined, CloudSync, Launch } from "@mui/icons-material";
import { Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { api } from "@/api/client";
import { upworkInboxQueries } from "@/api/queries";
import { useApiMutation } from "@/api/use-api-mutation";
import { useCreateRequest } from "@/components/features/pilot/requests/use-create-request";
import { TooltipButton, TooltipIconButton } from "@/components/ui/buttons";
import { ListLead, ListRow } from "@/components/ui/data";
import { RelativeTime, StatusChip, statusOptions } from "@/components/ui/display";
import { EmptyState } from "@/components/ui/feedback";
import { FilterToggle } from "@/components/ui/form";
import { useLiveInvalidation } from "@/hooks/use-live-invalidation";
import { usePaginationParams } from "@/hooks/use-pagination";
import { initials, plural } from "@/utils/format";
import { enumParam } from "@/utils/search-params";
import { UPWORK_PAGE_SIZE, UpworkListFrame } from "../upwork-list-frame";

const KIND_OPTIONS = statusOptions("upworkInboxKind");
const INBOX_STATUS_OPTIONS = statusOptions("upworkInboxStatus");

interface InboxStatusChange {
  id: string;
  status: UpworkInboxStatus;
}

export function InboxList(): ReactElement {
  const request = useCreateRequest();
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
        <TooltipButton
          title="Ask the pilot to mirror invitations, offers and messages"
          size="small"
          variant="outlined"
          startIcon={<CloudSync fontSize="sm" />}
          loading={request.isPending}
          onClick={() => request.mutate({ taskType: "upwork.syncInbox", payload: {} })}
        >
          Sync
        </TooltipButton>
      }
      query={inbox}
      pager={pager}
      errorTitle="Couldn't load your Upwork inbox."
      empty={<InboxEmptyState hasFilters={hasFilters} />}
    >
      {(inbox.data?.items ?? []).map((item) => (
        <ListRow
          key={item.id}
          lead={<ListLead>{initials(item.clientName || item.title)}</ListLead>}
          title={item.title}
          meta={item.clientName}
          note={
            item.body && (
              <Typography
                variant="body2Muted"
                sx={{
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {item.body}
              </Typography>
            )
          }
          actions={
            <>
              {item.jobUrl && (
                <TooltipIconButton title="Open on Upwork" href={item.jobUrl} size="small">
                  <Launch fontSize="sm" />
                </TooltipIconButton>
              )}
              {item.status !== "archived" && (
                <TooltipIconButton
                  title="Archive"
                  size="small"
                  onClick={() => setStatus.mutate({ id: item.id, status: "archived" })}
                >
                  <ArchiveOutlined fontSize="sm" />
                </TooltipIconButton>
              )}
            </>
          }
          status={
            <StatusChip
              domain="upworkInboxKind"
              value={item.kind}
              variant={item.status === "unread" ? "filled" : "outlined"}
            />
          }
          time={<RelativeTime value={item.receivedAt} />}
        />
      ))}
    </UpworkListFrame>
  );
}

interface InboxEmptyStateProps {
  hasFilters: boolean;
}

function InboxEmptyState(props: InboxEmptyStateProps): ReactElement {
  const { hasFilters } = props;

  if (hasFilters) {
    return <EmptyState variant="inline" title="No items match the current filter." />;
  }
  return (
    <EmptyState
      variant="inline"
      title="Nothing here yet."
      description="Run Sync to pull your invitations, offers and messages from Upwork."
    />
  );
}
