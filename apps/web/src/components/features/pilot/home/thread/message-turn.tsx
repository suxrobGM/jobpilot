import type { ReactElement } from "react";
import type { PilotMessage } from "@jobpilot/contracts/pilot";
import { Box, Typography } from "@mui/material";
import { PilotTurn } from "./pilot-turn";

interface MessageTurnProps {
  message: PilotMessage;
}

/** The user's messages sit right in a bubble; the pilot's read as plain text. Both keep line breaks. */
export function MessageTurn(props: MessageTurnProps): ReactElement {
  const { message } = props;
  const body = (
    <Typography variant="body1" sx={{ whiteSpace: "pre-line", overflowWrap: "anywhere" }}>
      {message.body}
    </Typography>
  );
  if (message.author === "pilot") {
    return <PilotTurn at={message.createdAt}>{body}</PilotTurn>;
  }
  return (
    <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
      <Box
        sx={(theme) => ({
          maxWidth: "75%",
          px: 2,
          py: 1.25,
          border: 1,
          borderColor: "line.borderHi",
          backgroundColor: theme.palette.surfaces.elevated,
          // The tail corner points at the sender.
          borderRadius: `${theme.radii.lg * 1.5}px ${theme.radii.lg * 1.5}px ${theme.radii.sm}px ${theme.radii.lg * 1.5}px`,
        })}
      >
        {body}
      </Box>
    </Box>
  );
}
