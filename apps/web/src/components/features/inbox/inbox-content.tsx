"use client";

import type { ReactElement, ReactNode } from "react";
import { REVIEW_STATUSES, type ReviewStatus } from "@jobpilot/contracts/email";
import { inboxChannel } from "@jobpilot/contracts/sse";
import { Box, LinearProgress, Stack, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { emailQueries } from "@/api/queries";
import { MailboxReauthAlert } from "@/components/features/settings";
import { LinkButton } from "@/components/ui/buttons";
import { PaginationFooter } from "@/components/ui/data";
import { EmptyState, QueryError } from "@/components/ui/feedback";
import { FilterToggle, type SelectFieldOption } from "@/components/ui/form";
import { PageHeader, PageShell } from "@/components/ui/layout";
import { useLiveInvalidation } from "@/hooks/use-live-invalidation";
import { usePaginationParams } from "@/hooks/use-pagination";
import { enumParam } from "@/utils/search-params";
import { InboxActions } from "./inbox-actions";
import { MessageList } from "./message-list";

const FILTERS: SelectFieldOption<ReviewStatus>[] = [
  { value: "pending", label: "To review" },
  { value: "auto", label: "Auto" },
  { value: "approved", label: "Approved" },
  { value: "denied", label: "Denied" },
];

/** Mail grouped by what it means for your applications; a message opens on its own page. */
export function InboxContent(): ReactElement {
  // In the URL, so a refresh, a shared link, or Back from a message keeps the view.
  const searchParams = useSearchParams();
  const filter = enumParam(REVIEW_STATUSES, searchParams.get("filter"));

  const account = useQuery(emailQueries.account());
  const status = account.data;
  const connected = status?.connected === true;

  const pagination = usePaginationParams();
  const messages = useQuery({
    ...emailQueries.messages(filter, pagination.query),
    enabled: connected,
  });

  useLiveInvalidation(inboxChannel, null, {
    enabled: connected,
    on: {
      "sync.started": [emailQueries.all],
      "sync.progress": [emailQueries.all],
      "message.scanned": [emailQueries.all],
      "message.reviewed": [emailQueries.all],
    },
  });

  if (account.isLoading) {
    return <LinearProgress />;
  }
  if (!connected) {
    return (
      <PageShell maxWidth="md">
        <PageHeader title="Inbox" />
        <EmptyState
          title="No mailbox connected"
          description="JobPilot reads new mail to track recruiter replies and auto-fill verification codes. Connect Gmail to get started."
          action={
            <LinkButton href="/settings/email" variant="contained">
              Connect Gmail
            </LinkButton>
          }
        />
      </PageShell>
    );
  }

  const rows = messages.data?.items ?? [];

  const renderList = (): ReactNode => {
    if (messages.isError) {
      return (
        <QueryError title="Couldn't load your inbox." onRetry={() => void messages.refetch()} />
      );
    }
    if (messages.isSuccess && rows.length === 0) {
      return <Typography variant="body2Muted">No messages here yet.</Typography>;
    }
    return (
      <MessageList
        messages={rows}
        listQuery={searchParams.toString()}
        footer={
          messages.data && (
            <PaginationFooter
              pagination={messages.data.pagination}
              onPageChange={pagination.setPage}
              onPageSizeChange={pagination.setPageSize}
            />
          )
        }
      />
    );
  };

  return (
    <PageShell maxWidth="lg">
      <PageHeader title="Inbox" actions={<InboxActions />} />
      {status.needsReauth && (
        <MailboxReauthAlert
          action={
            <LinkButton href="/settings/email" color="inherit" size="small">
              Reconnect
            </LinkButton>
          }
        />
      )}
      <Box sx={{ overflowX: "auto" }}>
        <FilterToggle
          label="Review status"
          value={filter}
          options={FILTERS}
          onChange={(next) => pagination.setFilters({ filter: next })}
        />
      </Box>
      <Stack>
        {messages.isFetching && <LinearProgress />}
        {renderList()}
      </Stack>
    </PageShell>
  );
}
