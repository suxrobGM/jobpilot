import type { ReactElement } from "react";
import { Chip, Paper, Stack, Typography } from "@mui/material";
import { PanelFrame } from "./panel-frame";

interface Message {
  from: string;
  subject: string;
  tag: string;
  tone: string;
  approve: boolean;
}

const MESSAGES: Message[] = [
  {
    from: "Sarah Chen · Vercel",
    subject: "Next steps for Design Engineer",
    tag: "interview request → recruiter screen",
    tone: "info.main",
    approve: true,
  },
  {
    from: "Greenhouse",
    subject: "We received your application to Datadog",
    tag: "confirmation · matched",
    tone: "text.secondary",
    approve: false,
  },
  {
    from: "Recruiting · Ramp",
    subject: "Update on your application",
    tag: "rejection → closed",
    tone: "error.main",
    approve: false,
  },
];

export function InboxPanel(): ReactElement {
  return (
    <PanelFrame label="inbox">
      <Stack spacing={1}>
        {MESSAGES.map((message) => (
          <Paper key={message.from} variant="inset" sx={{ padding: 1.25 }}>
            <Stack spacing={0.75}>
              <Stack direction="row" spacing={1} sx={{ justifyContent: "space-between" }}>
                <Typography variant="body2Strong" noWrap>
                  {message.from}
                </Typography>
                {message.approve && <Chip variant="outlined" color="success" label="Approve" />}
              </Stack>
              <Typography variant="captionMuted" noWrap>
                {message.subject}
              </Typography>
              <Typography variant="monoCaption" sx={{ color: message.tone }}>
                {message.tag}
              </Typography>
            </Stack>
          </Paper>
        ))}
      </Stack>
    </PanelFrame>
  );
}
