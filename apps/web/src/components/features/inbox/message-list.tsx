"use client";

import { type ReactElement, useState } from "react";
import { FilterAlt } from "@mui/icons-material";
import { Button } from "@mui/material";
import type { EmailMessageDto } from "@/api/types";
import { ListLead, ListRow } from "@/components/ui/data";
import { messageHref } from "@/utils/routes";
import { MessageRow } from "./message-row";
import { splitIrrelevant } from "./use-inbox-messages";

interface MessageListProps {
  messages: EmailMessageDto[];
  listQuery: string;
}

/** This page of mail, newest first; irrelevant mail folds behind one row so the rest stands out. */
export function MessageList(props: MessageListProps): ReactElement {
  const { messages, listQuery } = props;
  const [showFiltered, setShowFiltered] = useState(false);
  const { relevant, irrelevant } = splitIrrelevant(messages);

  const renderRows = (rows: EmailMessageDto[]): ReactElement[] =>
    rows.map((message) => (
      <MessageRow key={message.id} message={message} href={messageHref(message.id, listQuery)} />
    ));

  return (
    <>
      {renderRows(relevant)}
      {irrelevant.length > 0 && (
        <ListRow
          onOpen={() => setShowFiltered(!showFiltered)}
          lead={
            <ListLead>
              <FilterAlt fontSize="md" />
            </ListLead>
          }
          title={`${irrelevant.length} filtered out`}
          meta={irrelevant.map((message) => message.fromName || message.fromDomain).join(", ")}
          end={
            <Button size="small" color="inherit" onClick={() => setShowFiltered(!showFiltered)}>
              {showFiltered ? "Hide" : "Show"}
            </Button>
          }
        />
      )}
      {showFiltered && renderRows(irrelevant)}
    </>
  );
}
