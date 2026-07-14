"use client";

import { type ReactElement, useState } from "react";
import { LinearProgress, Stack } from "@mui/material";
import { useQueryClient } from "@tanstack/react-query";
import { useApiQuery } from "@/api/hooks";
import { emailQueries, type InboxFilter } from "@/api/queries";
import { queryKeys } from "@/api/query-keys";
import { LinkButton } from "@/components/ui/buttons";
import { EmptyState } from "@/components/ui/data/empty-state";
import { inboxChannel } from "@/lib/sse/channels/inbox";
import { useSseChannel } from "@/lib/sse/client";
import { useAgent, useAgentAvailable } from "@/providers/agent-provider";
import { InboxTable } from "./inbox-table";
import { InboxToolbar } from "./inbox-toolbar";
import { MessageReviewDialog } from "./message-review-dialog";

export function InboxContent(): ReactElement {
  const [filter, setFilter] = useState<InboxFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { injectSkill } = useAgent();
  const agentAvailable = useAgentAvailable();

  const account = useApiQuery(emailQueries.account());

  const connected = account.data?.connected === true;

  const messages = useApiQuery(emailQueries.messages(filter), { enabled: connected });

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
          <LinkButton href="/settings/email" variant="contained">
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
          onScanMessage={
            agentAvailable
              ? (row) => {
                  void injectSkill("scan-inbox", String(row.id));
                }
              : undefined
          }
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
