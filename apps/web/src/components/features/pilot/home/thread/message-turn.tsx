import type { ReactElement } from "react";
import type { PilotMessage } from "@jobpilot/contracts/pilot";
import { Box, Paper, Typography } from "@mui/material";
import { PilotTurn } from "./pilot-turn";

interface MessageTurnProps {
  message: PilotMessage;
}

/** The user's messages sit right in a bubble; the pilot's read as bare text. Both keep line breaks. */
export function MessageTurn(props: MessageTurnProps): ReactElement {
  const { message } = props;
  const body = (
    <Typography variant="body2" sx={{ whiteSpace: "pre-line", overflowWrap: "anywhere" }}>
      {message.body}
    </Typography>
  );
  if (message.author === "pilot") {
    return <PilotTurn at={message.createdAt}>{body}</PilotTurn>;
  }
  return (
    <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
      <Paper sx={{ px: 2, py: 1.25, maxWidth: "75%", bgcolor: "action.selected" }}>{body}</Paper>
    </Box>
  );
}
