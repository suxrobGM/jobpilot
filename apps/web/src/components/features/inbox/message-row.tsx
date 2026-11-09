"use client";

import type { ReactElement } from "react";
import { WorkOutlined } from "@mui/icons-material";
import { Stack, Typography } from "@mui/material";
import type { Route } from "next";
import type { EmailMessageDto } from "@/api/types";
import { ListLead, ListRow } from "@/components/ui/data";
import { RelativeTime, StatusChip } from "@/components/ui/display";
import { initials } from "@/utils/format";

interface MessageRowProps {
  message: EmailMessageDto;
  href: Route;
}

export function MessageRow(props: MessageRowProps): ReactElement {
  const { message, href } = props;
  const sender = message.fromName || message.fromAddress;
  const matched = message.application;

  return (
    <ListRow
      href={href}
      lead={<ListLead>{initials(sender)}</ListLead>}
      title={sender}
      tags={
        <Typography variant="captionMuted" noWrap sx={{ display: { xs: "none", sm: "block" } }}>
          {message.fromDomain}
        </Typography>
      }
      meta={message.subject}
      note={
        <>
          <Typography variant="captionMuted" noWrap component="div">
            {message.snippet}
          </Typography>
          {matched && (
            <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", pt: 0.25 }}>
              <WorkOutlined fontSize="sm" sx={{ color: "text.secondary" }} />
              <Typography variant="captionMuted" noWrap>
                {`${matched.title} · ${matched.company}`}
              </Typography>
            </Stack>
          )}
        </>
      }
      status={
        message.classification && (
          <StatusChip domain="classification" value={message.classification} />
        )
      }
      time={<RelativeTime value={message.receivedAt} />}
    />
  );
}
