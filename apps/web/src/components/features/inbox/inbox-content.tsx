"use client";

import { type ReactElement, type ReactNode, useState } from "react";
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
import { useAgentAvailable } from "@/providers/agent-provider";
import { enumParam } from "@/utils/search-params";
import { InboxActions } from "./inbox-actions";
import { MessageList } from "./message-list";
import { MessageReview } from "./message-review";

const FILTERS: SelectFieldOption<ReviewStatus>[] = [
  { value: "pending", label: "To review" },
  { value: "auto", label: "Auto" },
  { value: "approved", label: "Approved" },
  { value: "denied", label: "Denied" },
];

/** No mailbox yet: the one thing to do is connect one. */
function NotConnected(): ReactElement {
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

/** The detail pane's resting state, which also explains what reviewing does. */
function NothingOpen(): ReactElement {
  return (
    <Stack sx={{ flex: 1, alignItems: "center", justifyContent: "center", textAlign: "center" }}>
      <Typography variant="body1Strong">Pick a message</Typography>
      <Typography variant="body2Muted" sx={{ maxWidth: 360 }}>
        Approving one updates the matching application's status. J and K step through the list.
      </Typography>
    </Stack>
  );
}

/** A list of mail beside the open message; on phones the open message takes the screen. */
export function InboxContent(): ReactElement {
  // In the URL, so a refresh or a shared link keeps the filter along with the page.
  const filter = enumParam(REVIEW_STATUSES, useSearchParams().get("filter"));
  const [openId, setOpenId] = useState<string | null>(null);
  const isDesktop = useAgentAvailable();

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
    return <NotConnected />;
  }

  const rows = messages.data?.items ?? [];
  const step = (direction: 1 | -1): void => {
    const at = rows.findIndex((row) => row.id === openId);
    const next = rows[at + direction];
    if (next) {
      setOpenId(next.id);
    }
  };

  const renderList = (): ReactNode => {
    if (messages.isError) {
      return (
        <QueryError title="Couldn't load your inbox." onRetry={() => void messages.refetch()} />
      );
    }
    if (messages.isSuccess && rows.length === 0) {
      return (
        <Typography variant="body2Muted" sx={{ p: 2 }}>
          No messages here yet.
        </Typography>
      );
    }
    return <MessageList messages={rows} selectedId={openId} onOpen={(m) => setOpenId(m.id)} />;
  };

  const list = (
    <Stack
      sx={(theme) => ({
        width: { xs: "100%", md: 460 },
        flexShrink: 0,
        minHeight: 0,
        borderRight: { md: 1 },
        borderColor: { md: "divider" },
        backgroundColor: { md: theme.palette.surfaces.panel },
      })}
    >
      <Stack spacing={1.5} sx={{ p: 2, pb: 1.5, borderBottom: 1, borderColor: "divider" }}>
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
            onChange={(next) => {
              setOpenId(null);
              pagination.setFilters({ filter: next });
            }}
          />
        </Box>
      </Stack>
      {messages.isFetching && <LinearProgress />}
      <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
        {renderList()}
        {messages.data && (
          <Box sx={{ px: 2, pb: 2 }}>
            <PaginationFooter
              pagination={messages.data.pagination}
              onPageChange={pagination.setPage}
            />
          </Box>
        )}
      </Box>
    </Stack>
  );

  const detail = openId ? (
    <MessageReview key={openId} messageId={openId} onBack={() => setOpenId(null)} onStep={step} />
  ) : (
    <NothingOpen />
  );

  return (
    <Stack
      direction="row"
      // Basis 0 fills what the top bar leaves; the list and the message each scroll on their own.
      sx={{ flex: "1 1 0", minHeight: 0 }}
    >
      <PageHeader title="Inbox" actions={<InboxActions />} />
      {(isDesktop || !openId) && list}
      {(isDesktop || openId) && (
        <Stack sx={{ flex: 1, minWidth: 0, px: { xs: 1.5, sm: 3 }, py: 2 }}>{detail}</Stack>
      )}
    </Stack>
  );
}
