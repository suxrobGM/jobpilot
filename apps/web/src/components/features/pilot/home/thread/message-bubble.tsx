import type { ReactElement } from "react";
import type { PilotMessage } from "@jobpilot/contracts/pilot";
import { Box, Paper, Typography } from "@mui/material";
import { RelativeTime } from "@/components/ui/display";

interface MessageBubbleProps {
  message: PilotMessage;
}

/** The user's messages sit right, the pilot's left; replies keep their line breaks. */
export function MessageBubble(props: MessageBubbleProps): ReactElement {
  const { message } = props;
  const mine = message.author === "user";
  return (
    <Box sx={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start" }}>
      <Paper
        variant="outlined"
        sx={{
          px: 2,
          py: 1.25,
          maxWidth: "80%",
          bgcolor: mine ? "action.selected" : "background.paper",
        }}
      >
        <Typography variant="captionMuted">{mine ? "You" : "Pilot"}</Typography>
        <Typography variant="body2" sx={{ whiteSpace: "pre-line", overflowWrap: "anywhere" }}>
          {message.body}
        </Typography>
        <RelativeTime value={message.createdAt} sx={{ display: "block", mt: 0.5 }} />
      </Paper>
    </Box>
  );
}
