import type { ReactElement } from "react";
import { Box, Stack, Typography } from "@mui/material";
import { fontFamilies } from "@/theme";
import { PanelBadge, PanelFrame, panelCellSx } from "./panel-frame";

interface Message {
  from: string;
  subject: string;
  tag: string;
  tone: string;
  approve?: boolean;
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
  },
  {
    from: "Recruiting · Ramp",
    subject: "Update on your application",
    tag: "rejection → closed",
    tone: "error.main",
  },
];

export function InboxPanel(): ReactElement {
  return (
    <PanelFrame label="inbox">
      <Stack spacing={1}>
        {MESSAGES.map((message) => (
          <Box key={message.from} sx={[panelCellSx, { padding: 1.25 }]}>
            <Stack spacing={0.75}>
              <Stack direction="row" spacing={1} sx={{ justifyContent: "space-between" }}>
                <Typography sx={{ fontSize: "0.75rem", fontWeight: 600 }} noWrap>
                  {message.from}
                </Typography>
                {message.approve && (
                  <PanelBadge color="success.main" sx={{ alignSelf: "flex-start" }}>
                    Approve
                  </PanelBadge>
                )}
              </Stack>
              <Typography variant="captionMuted" noWrap sx={{ display: "block" }}>
                {message.subject}
              </Typography>
              <Typography
                sx={{
                  fontFamily: fontFamilies.mono,
                  fontSize: "0.6875rem",
                  color: message.tone,
                }}
              >
                {message.tag}
              </Typography>
            </Stack>
          </Box>
        ))}
      </Stack>
    </PanelFrame>
  );
}
