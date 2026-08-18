"use client";

import { type ReactElement, useState } from "react";
import type { NetworkingMessageDto } from "@/api/types";
import { DataTable } from "@/components/ui/data/data-table";
import { networkingMessageColumns, openActionColumn } from "./networking-message-columns";
import { NetworkingMessageDialog } from "./networking-message-dialog";

interface NetworkingMessagesTableProps {
  messages: ReadonlyArray<NetworkingMessageDto>;
  loading?: boolean;
  emptyMessage?: string;
  /** A draft to open on arrival, from the pilot's approval deep link. */
  openMessageId?: string;
}

const DEFAULT_EMPTY = "No outreach yet - the pilot drafts intros as it applies.";

/** The campaign board covers networking campaigns only, so job-campaign drafts read through here. */
export function NetworkingMessagesTable(props: NetworkingMessagesTableProps): ReactElement {
  const { messages, loading, emptyMessage = DEFAULT_EMPTY, openMessageId } = props;
  const [openId, setOpenId] = useState<string | null>(openMessageId ?? null);

  const openMessage = messages.find((m) => m.id === openId) ?? null;

  return (
    <>
      <DataTable
        rows={messages}
        columns={[...networkingMessageColumns, openActionColumn(setOpenId)]}
        loading={loading}
        getRowId={(row) => row.id}
        autoHeight
        hideFooter
        emptyMessage={emptyMessage}
      />

      {openMessage?.campaignId && (
        <NetworkingMessageDialog
          campaignId={openMessage.campaignId}
          message={openMessage}
          onClose={() => setOpenId(null)}
        />
      )}
    </>
  );
}
