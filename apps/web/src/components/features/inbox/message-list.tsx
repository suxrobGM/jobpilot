"use client";

import { type ReactElement, useState } from "react";
import type { Classification } from "@jobpilot/contracts/email";
import { FilterAlt } from "@mui/icons-material";
import { Button, Paper, Stack, Typography } from "@mui/material";
import type { EmailMessageDto } from "@/api/types";
import { statusLabel } from "@/components/ui/display";
import { MessageRow } from "./message-row";

/** Mail that moves an application first; irrelevant mail folds behind one row at the end. */
const GROUP_ORDER: (Classification | null)[] = [
  "interviewing",
  "offer",
  "rejected",
  "verification",
  null,
];

function groupLabel(classification: Classification | null): string {
  return classification ? statusLabel("classification", classification) : "Not scanned yet";
}

interface MessageListProps {
  messages: EmailMessageDto[];
  selectedId: string | null;
  onOpen: (message: EmailMessageDto) => void;
}

/** This page of mail grouped by class, so the few messages that matter aren't lost in the noise. */
export function MessageList(props: MessageListProps): ReactElement {
  const { messages, selectedId, onOpen } = props;
  const [showFiltered, setShowFiltered] = useState(false);
  const irrelevant = messages.filter((message) => message.classification === "irrelevant");

  const renderRows = (rows: EmailMessageDto[]): ReactElement[] =>
    rows.map((message) => (
      <MessageRow
        key={message.id}
        message={message}
        selected={message.id === selectedId}
        onOpen={() => onOpen(message)}
      />
    ));

  return (
    <Stack>
      {GROUP_ORDER.map((classification) => {
        const rows = messages.filter((message) => message.classification === classification);
        if (rows.length === 0) {
          return null;
        }
        return (
          <Stack key={classification ?? "unscanned"}>
            <Typography variant="overlineMuted" sx={{ px: 2, pt: 2, pb: 0.75 }}>
              {`${groupLabel(classification)} · ${rows.length}`}
            </Typography>
            {renderRows(rows)}
          </Stack>
        );
      })}
      {irrelevant.length > 0 && (
        <Paper
          variant="outlined"
          sx={{ m: 2, px: 2, py: 1.5, borderStyle: "dashed", bgcolor: "transparent" }}
        >
          <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
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
        </Paper>
      )}
      {showFiltered && renderRows(irrelevant)}
    </Stack>
  );
}
