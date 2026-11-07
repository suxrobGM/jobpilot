"use client";

import { type ReactElement, useState } from "react";
import { isTerminalNetworkingStatus } from "@jobpilot/contracts/networking";
import { Button } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { api } from "@/api/client";
import { networkingQueries } from "@/api/queries";
import type { NetworkingMessageDto } from "@/api/types";
import { useApiMutation } from "@/api/use-api-mutation";
import { useCreateRequest } from "@/components/features/pilot/requests/use-create-request";
import { ListHeader, ListLead, ListRow, PagedList } from "@/components/ui/data";
import { StatusChip } from "@/components/ui/display";
import { EmptyState } from "@/components/ui/feedback";
import { usePaginationParams } from "@/hooks/use-pagination";
import { useRowSelection } from "@/hooks/use-row-selection";
import { initials } from "@/utils/format";
import { NetworkingMessageDialog } from "./networking-message-dialog";

function channelLabel(message: NetworkingMessageDto): string {
  if (message.channel !== "linkedin") {
    return "Email";
  }
  return message.linkedinKind ? `LinkedIn · ${message.linkedinKind}` : "LinkedIn";
}

function metaLine(message: NetworkingMessageDto): string {
  const { contact } = message;
  return [`To ${contact.name}`, contact.company, channelLabel(message)].filter(Boolean).join(" · ");
}

/** Every outreach draft, one server page at a time, with bulk approve and rewrite. */
export function NetworkingMessagesList(): ReactElement {
  const request = useCreateRequest();
  const pagination = usePaginationParams();
  // The pilot's approval question deep-links straight to one draft.
  const [openId, setOpenId] = useState(useSearchParams().get("message"));
  const query = useQuery(networkingQueries.messages(pagination.query));

  const messages = query.data?.items ?? [];
  const selection = useRowSelection(messages);
  const openMessage = messages.find((m) => m.id === openId) ?? null;
  const actionable = selection.picked.flatMap((m) =>
    m.feedId && !isTerminalNetworkingStatus(m.status) ? [{ id: m.id, feedId: m.feedId }] : [],
  );

  const approveSelected = useApiMutation(
    async () => {
      const results = await Promise.all(
        actionable.map((message) =>
          api
            .feeds({ id: message.feedId })
            .networking.messages({ messageId: message.id })
            .patch({ status: "approved" }),
        ),
      );
      const failed = results.find((res) => res.error);
      return failed
        ? { data: null, error: failed.error }
        : { data: actionable.length, error: null };
    },
    {
      invalidate: [networkingQueries.all],
      successMessage: "Approved the selected drafts.",
      onSuccess: selection.clear,
    },
  );

  const rewriteSelected = (): void => {
    request.mutate({
      taskType: "networking.rewrite",
      payload: { messageIds: actionable.map((m) => m.id) },
    });
    selection.clear();
  };

  return (
    <>
      <PagedList
        query={query}
        pager={pagination}
        isEmpty={messages.length === 0}
        errorTitle="Couldn't load outreach messages."
        empty={
          <EmptyState
            variant="inline"
            title="No outreach yet."
            description="The pilot drafts intros as it applies."
          />
        }
        header={
          <ListHeader
            selection={selection.header}
            bulkActions={
              <>
                <Button
                  size="small"
                  variant="contained"
                  disabled={actionable.length === 0}
                  loading={approveSelected.isPending}
                  onClick={() => approveSelected.mutate()}
                >
                  Approve
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  disabled={actionable.length === 0}
                  onClick={rewriteSelected}
                >
                  Rewrite
                </Button>
              </>
            }
          >
            Latest first
          </ListHeader>
        }
      >
        {messages.map((message) => (
          <ListRow
            key={message.id}
            onOpen={() => setOpenId(message.id)}
            selection={selection.row(message, message.contact.name)}
            lead={<ListLead>{initials(message.contact.name)}</ListLead>}
            title={message.subject ?? message.body.slice(0, 120)}
            meta={metaLine(message)}
            status={<StatusChip domain="networking" value={message.status} />}
          />
        ))}
      </PagedList>
      {openMessage?.feedId && (
        <NetworkingMessageDialog
          feedId={openMessage.feedId}
          message={openMessage}
          onClose={() => setOpenId(null)}
        />
      )}
    </>
  );
}
