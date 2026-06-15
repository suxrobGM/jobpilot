"use client";

import { useState, type ReactElement } from "react";
import { LinearProgress, Stack } from "@mui/material";
import { useQueryClient } from "@tanstack/react-query";
import { unwrap } from "@/api/client";
import { api } from "@/api/eden";
import { useApiQuery } from "@/api/hooks";
import { queryKeys } from "@/api/query-keys";
import type { EmailAccountStatus, EmailMessageDto } from "@/api/types";
import { LinkButton } from "@/components/ui/buttons";
import { EmptyState } from "@/components/ui/data/empty-state";
import { inboxChannel } from "@/lib/sse/channels/inbox";
import { useSseChannel } from "@/lib/sse/client";
import { useAgent } from "@/providers/agent-provider";
import { InboxTable } from "./inbox-table";
import { InboxToolbar } from "./inbox-toolbar";
import { MessageReviewDialog } from "./message-review-dialog";

export type InboxFilter = "pending" | "auto" | "approved" | "denied" | "all";

function buildQuery(filter: InboxFilter): { reviewStatus?: InboxFilter } {
  if (filter === "all") return {};
  return { reviewStatus: filter };
}

export function InboxContent(): ReactElement {
  const [filter, setFilter] = useState<InboxFilter>("all");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const queryClient = useQueryClient();
  const { injectSkill } = useAgent();

  const account = useApiQuery<EmailAccountStatus>(queryKeys.email.account(), () =>
    unwrap(api.email.account.get()),
  );

  const connected = account.data?.connected === true;

  const filters = { filter };
  const messages = useApiQuery<EmailMessageDto[]>(
    queryKeys.email.messages(filters as Record<string, unknown>),
    () => unwrap(api.email.messages.get({ query: buildQuery(filter) })),
    { enabled: connected },
  );

  useSseChannel(inboxChannel, null, {
    enabled: connected,
    onMessage: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.email.all });
    },
  });

  if (account.isLoading) {
    return <LinearProgress />;
  }

  if (!connected) {
    return (
      <EmptyState
        title="No mailbox connected"
        description="JobPilot reads new mail to track recruiter replies and auto-fill verification codes. Connect Gmail to get started."
        action={
          <LinkButton href="/profile?tab=email" variant="contained">
            Connect Gmail
          </LinkButton>
        }
      />
    );
  }

  return (
    <Stack spacing={2}>
      <InboxToolbar filter={filter} onFilterChange={setFilter} />
      {messages.isLoading ? (
        <LinearProgress />
      ) : (
        <InboxTable
          rows={messages.data ?? []}
          loading={messages.isFetching}
          onRowClick={(row) => setSelectedId(row.id)}
          onScanMessage={(row) => {
            void injectSkill("scan-inbox", String(row.id));
          }}
        />
      )}
      <MessageReviewDialog
        messageId={selectedId}
        open={selectedId !== null}
        onClose={() => setSelectedId(null)}
      />
    </Stack>
  );
}
