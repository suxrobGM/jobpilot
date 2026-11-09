"use client";

import type { ReactElement } from "react";
import type { ReviewStatus } from "@jobpilot/contracts/email";
import { inboxChannel } from "@jobpilot/contracts/sse";
import { Box, LinearProgress } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { emailQueries } from "@/api/queries";
import { MailboxReauthAlert } from "@/components/features/settings";
import { LinkButton } from "@/components/ui/buttons";
import { PagedList } from "@/components/ui/data";
import { EmptyState } from "@/components/ui/feedback";
import { FilterToggle, type SelectFieldOption } from "@/components/ui/form";
import { PageHeader, PageShell } from "@/components/ui/layout";
import { useLiveInvalidation } from "@/hooks/use-live-invalidation";
import { InboxActions } from "./inbox-actions";
import { MessageList } from "./message-list";
import { useInboxMessages } from "./use-inbox-messages";

const FILTERS: SelectFieldOption<ReviewStatus>[] = [
  { value: "pending", label: "To review" },
  { value: "auto", label: "Auto" },
  { value: "approved", label: "Approved" },
  { value: "denied", label: "Denied" },
];

/** Mail grouped by what it means for your applications; a message opens on its own page. */
export function InboxContent(): ReactElement {
  const account = useQuery(emailQueries.account());
  const status = account.data;
  const connected = status?.connected === true;
  const { query: messages, filter, pagination, listQuery } = useInboxMessages(connected);

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
          description="JobPilot reads new mail to track recruiter replies and auto-fill verification codes. Connect email to get started."
          action={
            <LinkButton href="/settings/email" variant="contained">
              Connect email
            </LinkButton>
          }
        />
      </PageShell>
    );
  }

  const rows = messages.data?.items ?? [];

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
      <PagedList
        query={messages}
        pager={pagination}
        errorTitle="Couldn't load your inbox."
        isEmpty={rows.length === 0}
        empty={<EmptyState variant="inline" title="No messages here yet." />}
      >
        <MessageList messages={rows} listQuery={listQuery} />
      </PagedList>
    </PageShell>
  );
}
