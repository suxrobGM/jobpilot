"use client";

import type { ReactElement } from "react";
import { Avatar, ButtonBase, Stack, Typography } from "@mui/material";
import type { EmailMessageDto } from "@/api/types";
import { RelativeTime, StatusChip } from "@/components/ui/display";

interface MessageRowProps {
  message: EmailMessageDto;
  selected: boolean;
  onOpen: () => void;
}

export function MessageRow(props: MessageRowProps): ReactElement {
  const { message, selected, onOpen } = props;
  const sender = message.fromName || message.fromAddress;

  return (
    <ButtonBase
      onClick={onOpen}
      aria-current={selected || undefined}
      sx={(theme) => ({
        display: "flex",
        width: "100%",
        gap: 1.5,
        alignItems: "flex-start",
        textAlign: "left",
        px: 2,
        py: 1.5,
        borderLeft: 2,
        borderColor: selected ? "accent.primary" : "transparent",
        backgroundColor: selected ? theme.palette.surfaces.card : "transparent",
        transition: theme.motion.fast,
        "&:hover": { backgroundColor: theme.palette.surfaces.card },
        "&.Mui-focusVisible": { boxShadow: theme.shadows_custom.focus },
      })}
    >
      <Avatar
        variant="rounded"
        sx={(theme) => ({
          width: 34,
          height: 34,
          ...theme.typography.body2Strong,
          bgcolor: theme.palette.surfaces.elevated,
          color: "text.secondary",
        })}
      >
        {sender.charAt(0).toUpperCase()}
      </Avatar>
      <Stack spacing={0.25} sx={{ flex: 1, minWidth: 0 }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: "baseline", minWidth: 0 }}>
          <Typography variant="body2Strong" noWrap>
            {sender}
          </Typography>
          <Typography variant="captionMuted" noWrap>
            {message.fromDomain}
          </Typography>
        </Stack>
        <Typography variant="body2Muted" noWrap>
          {message.subject}
        </Typography>
      </Stack>
      <Stack spacing={0.75} sx={{ alignItems: "flex-end", flexShrink: 0 }}>
        <RelativeTime value={message.receivedAt} />
        {message.classification && (
          <StatusChip domain="classification" value={message.classification} />
        )}
      </Stack>
    </ButtonBase>
  );
}
