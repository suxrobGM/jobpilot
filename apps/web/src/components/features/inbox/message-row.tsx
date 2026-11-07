"use client";

import type { ReactElement } from "react";
import { WorkOutlined } from "@mui/icons-material";
import { Avatar, Box, Stack, Typography } from "@mui/material";
import type { Route } from "next";
import NextLink from "next/link";
import type { EmailMessageDto } from "@/api/types";
import { RelativeTime, StatusChip } from "@/components/ui/display";

interface MessageRowProps {
  message: EmailMessageDto;
  href: Route;
}

export function MessageRow(props: MessageRowProps): ReactElement {
  const { message, href } = props;
  const sender = message.fromName || message.fromAddress;
  const matched = message.application;

  return (
    <Box
      component={NextLink}
      href={href}
      sx={(theme) => ({
        display: "flex",
        gap: 1.5,
        alignItems: "flex-start",
        px: { xs: 1.5, sm: 2 },
        py: 1.5,
        color: "inherit",
        textDecoration: "none",
        borderRadius: theme.radii.lg,
        transition: theme.motion.fast,
        "&:hover": { backgroundColor: theme.palette.surfaces.card },
        "&:focus-visible": { outline: "none", boxShadow: theme.shadows_custom.focus },
      })}
    >
      <Avatar
        variant="rounded"
        sx={(theme) => ({
          width: 36,
          height: 36,
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
          <Typography variant="captionMuted" noWrap sx={{ display: { xs: "none", sm: "block" } }}>
            {message.fromDomain}
          </Typography>
        </Stack>
        <Typography variant="body2" noWrap>
          {message.subject}
        </Typography>
        <Typography variant="body2Muted" noWrap>
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
      </Stack>
      <Stack spacing={0.75} sx={{ alignItems: "flex-end", flexShrink: 0 }}>
        <RelativeTime value={message.receivedAt} />
        {message.classification && (
          <StatusChip domain="classification" value={message.classification} />
        )}
      </Stack>
    </Box>
  );
}
