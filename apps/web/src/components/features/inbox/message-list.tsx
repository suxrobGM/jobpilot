"use client";

import { type ReactElement, type ReactNode, useState } from "react";
import { FilterAlt } from "@mui/icons-material";
import { Button, Stack, Typography } from "@mui/material";
import type { EmailMessageDto } from "@/api/types";
import { ListCard } from "@/components/ui/data";
import { messageHref } from "@/utils/routes";
import { MessageRow } from "./message-row";

function isIrrelevant(message: EmailMessageDto): boolean {
  return message.classification === "irrelevant";
}

/** The list's reading order, newest first with irrelevant mail last: next/previous follow it too. */
export function listOrder(messages: EmailMessageDto[]): EmailMessageDto[] {
  return [
    ...messages.filter((message) => !isIrrelevant(message)),
    ...messages.filter(isIrrelevant),
  ];
}

interface MessageListProps {
  messages: EmailMessageDto[];
  /** The list's `?filter=&page=`, carried into each message for Back and next/previous. */
  listQuery: string;
  footer: ReactNode;
}

/** This page of mail, newest first; irrelevant mail folds behind one row so the rest stands out. */
export function MessageList(props: MessageListProps): ReactElement {
  const { messages, listQuery, footer } = props;
  const [showFiltered, setShowFiltered] = useState(false);
  const relevant = messages.filter((message) => !isIrrelevant(message));
  const irrelevant = messages.filter(isIrrelevant);

  const renderRows = (rows: EmailMessageDto[]): ReactElement[] =>
    rows.map((message) => (
      <MessageRow key={message.id} message={message} href={messageHref(message.id, listQuery)} />
    ));

  return (
    <ListCard footer={footer}>
      {renderRows(relevant)}
      {irrelevant.length > 0 && (
        <Stack
          direction="row"
          spacing={1.5}
          sx={{
            alignItems: "center",
            px: { xs: 1.5, sm: 2 },
            py: 1.5,
            borderBottom: 1,
            borderColor: "divider",
            "&:last-child": { borderBottom: 0 },
          }}
        >
          <FilterAlt fontSize="md" sx={{ color: "text.secondary" }} />
          <Stack sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="body2Strong">{`${irrelevant.length} filtered out`}</Typography>
            <Typography variant="captionMuted" noWrap>
              {irrelevant.map((message) => message.fromName || message.fromDomain).join(", ")}
            </Typography>
          </Stack>
          <Button size="small" color="inherit" onClick={() => setShowFiltered(!showFiltered)}>
            {showFiltered ? "Hide" : "Show"}
          </Button>
        </Stack>
      )}
      {showFiltered && renderRows(irrelevant)}
    </ListCard>
  );
}
