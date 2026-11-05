"use client";

import { type ReactElement, useState } from "react";
import { REVIEW_STATUSES } from "@jobpilot/contracts/email";
import { inboxChannel } from "@jobpilot/contracts/sse";
import { LinearProgress, Stack } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { emailQueries } from "@/api/queries";
import { MailboxReauthAlert } from "@/components/features/settings";
import { LinkButton } from "@/components/ui/buttons";
import { EmptyState } from "@/components/ui/feedback";
import { useLiveInvalidation } from "@/hooks/use-live-invalidation";
import { gridPagination, usePaginationParams } from "@/hooks/use-pagination";
import { enumParam } from "@/utils/search-params";
import { InboxTable } from "./inbox-table";
import { InboxToolbar } from "./inbox-toolbar";
import { MessageReviewDialog } from "./message-review-dialog";

export function InboxContent(): ReactElement {
  // In the URL, so a refresh or a shared link keeps the filter along with the page.
  const filter = enumParam(REVIEW_STATUSES, useSearchParams().get("filter"));
  const [selectedId, setSelectedId] = useState<string | null>(null);

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
      <EmptyState
        title="No mailbox connected"
        description="JobPilot reads new mail to track recruiter replies and auto-fill verification codes. Connect email to get started."
        action={
          <LinkButton href="/settings/email" variant="contained">
            Connect email
          </LinkButton>
        }
      />
    );
  }

  return (
    <Stack spacing={2}>
      {status.needsReauth && (
        <MailboxReauthAlert
          action={
            <LinkButton href="/settings/email" color="inherit" size="small">
              Reconnect
            </LinkButton>
          }
        />
      )}
      <InboxToolbar
        filter={filter}
        onFilterChange={(next) => pagination.setFilters({ filter: next })}
      />
      <InboxTable
        rows={messages.data?.items ?? []}
        loading={messages.isFetching}
        errorTitle={messages.isError ? "Couldn't load your inbox." : undefined}
        onRetry={() => void messages.refetch()}
        {...gridPagination(pagination, messages.data?.pagination)}
        onRowClick={(row) => setSelectedId(row.id)}
      />
      <MessageReviewDialog
        messageId={selectedId}
        open={selectedId !== null}
        onClose={() => setSelectedId(null)}
      />
    </Stack>
  );
}
