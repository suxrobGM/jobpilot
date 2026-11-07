"use client";

import type { ReactElement } from "react";
import type { PilotQuestion } from "@jobpilot/contracts/pilot";
import { Check } from "@mui/icons-material";
import { Box, Stack, Typography } from "@mui/material";
import { PilotTurn } from "./pilot-turn";

const CLOSED_LABELS: Record<PilotQuestion["status"], string> = {
  open: "Waiting for you",
  answered: "Answered",
  expired: "Expired unanswered",
  cancelled: "No longer needed",
};

interface AskedRowProps {
  question: PilotQuestion;
}

/** A question that is no longer open, with what came of it; open ones wait in the queue. */
export function AskedRow(props: AskedRowProps): ReactElement {
  const { question } = props;
  const outcome = question.answer
    ? `You answered: ${question.answer}`
    : CLOSED_LABELS[question.status];
  return (
    <PilotTurn at={question.createdAt}>
      <Stack
        spacing={1}
        sx={(theme) => ({
          px: 1.5,
          py: 1.25,
          border: 1,
          borderColor: "line.border",
          borderRadius: theme.radii.lg,
        })}
      >
        <Typography variant="body2Muted">{question.prompt}</Typography>
        <Box
          sx={(theme) => ({
            alignSelf: "flex-start",
            display: "inline-flex",
            alignItems: "center",
            gap: 0.75,
            px: 1,
            py: 0.25,
            borderRadius: theme.radii.sm,
            backgroundColor: theme.palette.surfaces.elevated,
            typography: "caption",
          })}
        >
          {question.answer && <Check fontSize="xs" />}
          {outcome}
        </Box>
      </Stack>
    </PilotTurn>
  );
}
