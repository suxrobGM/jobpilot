"use client";

import type { ReactElement } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { networkingQueries } from "@/api/queries";
import { PaginationFooter } from "@/components/ui/data";
import { usePaginationParams } from "@/hooks/use-pagination";
import { NetworkingMessagesTable } from "./networking-messages-table";

/** Every campaign's outreach drafts, one server page at a time. */
export function NetworkingMessagesList(): ReactElement {
  const pagination = usePaginationParams();
  // The pilot's approval question deep-links straight to one draft.
  const openMessageId = useSearchParams().get("message");
  const messages = useQuery(networkingQueries.messages(pagination.query));

  return (
    <>
      <NetworkingMessagesTable
        messages={messages.data?.items ?? []}
        loading={messages.isPending}
        errorTitle={messages.isError ? "Couldn't load outreach messages." : undefined}
        onRetry={() => void messages.refetch()}
        openMessageId={openMessageId}
      />
      {messages.data && (
        <PaginationFooter
          pagination={messages.data.pagination}
          onPageChange={pagination.setPage}
          onPageSizeChange={pagination.setPageSize}
        />
      )}
    </>
  );
}
