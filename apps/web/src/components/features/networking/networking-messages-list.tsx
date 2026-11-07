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
import { ListCard, ListHeader, ListLead, ListRow, PaginationFooter } from "@/components/ui/data";
import { StatusChip } from "@/components/ui/display";
import { EmptyState, QuerySection } from "@/components/ui/feedback";
import { usePaginationParams } from "@/hooks/use-pagination";
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
  const [picked, setPicked] = useState<string[]>([]);
  const query = useQuery(networkingQueries.messages(pagination.query));

  const messages = query.data?.items ?? [];
  const openMessage = messages.find((m) => m.id === openId) ?? null;
  // A row that left the page after a refetch drops out of the selection.
  const pickedRows = messages.filter((m) => picked.includes(m.id));
  const actionable = pickedRows.flatMap((m) =>
    m.feedId && !isTerminalNetworkingStatus(m.status) ? [{ id: m.id, feedId: m.feedId }] : [],
  );
  const allPicked = messages.length > 0 && pickedRows.length === messages.length;

  const approveSelected = useApiMutation(
    async () => {
      for (const message of actionable) {
        const res = await api
          .feeds({ id: message.feedId })
          .networking.messages({ messageId: message.id })
          .patch({ status: "approved" });
        if (res.error) {
          return { data: null, error: res.error };
        }
      }
      return { data: actionable.length, error: null };
    },
    {
      invalidate: [networkingQueries.all],
      successMessage: "Approved the selected drafts.",
      onSuccess: () => setPicked([]),
    },
  );

  const rewriteSelected = (): void => {
    request.mutate({
      taskType: "networking.rewrite",
      payload: { messageIds: actionable.map((m) => m.id) },
    });
    setPicked([]);
  };

  const toggle = (id: string): void =>
    setPicked(picked.includes(id) ? picked.filter((other) => other !== id) : [...picked, id]);

  const selection = {
    count: pickedRows.length,
    total: messages.length,
    onToggleAll: () => setPicked(allPicked ? [] : messages.map((m) => m.id)),
  };

  return (
    <>
      <QuerySection
        query={query}
        errorTitle="Couldn't load outreach messages."
        isEmpty={messages.length === 0}
        empty={
          <EmptyState
            variant="inline"
            title="No outreach yet."
            description="The pilot drafts intros as it applies."
          />
        }
      >
        <ListCard
          header={
            <ListHeader
              selection={selection}
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
          footer={
            query.data && (
              <PaginationFooter
                pagination={query.data.pagination}
                onPageChange={pagination.setPage}
                onPageSizeChange={pagination.setPageSize}
              />
            )
          }
        >
          {messages.map((message) => (
            <ListRow
              key={message.id}
              onOpen={() => setOpenId(message.id)}
              selection={{
                selected: picked.includes(message.id),
                onToggle: () => toggle(message.id),
                label: message.contact.name,
              }}
              lead={<ListLead>{initials(message.contact.name)}</ListLead>}
              title={message.subject ?? message.body.slice(0, 120)}
              meta={metaLine(message)}
              status={<StatusChip domain="networking" value={message.status} />}
            />
          ))}
        </ListCard>
      </QuerySection>
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
