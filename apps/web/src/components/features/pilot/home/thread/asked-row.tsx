"use client";

import type { ReactElement } from "react";
import type { PilotQuestion } from "@jobpilot/contracts/pilot";
import { HelpOutlined } from "@mui/icons-material";
import { Stack, Typography } from "@mui/material";
import { RelativeTime } from "@/components/ui/display";

const CLOSED_LABELS: Record<PilotQuestion["status"], string> = {
  open: "Waiting for you",
  answered: "Answered",
  expired: "Expired unanswered",
  cancelled: "No longer needed",
};

interface AskedRowProps {
  question: PilotQuestion;
}

/** A question that is no longer open, folded to one line. */
export function AskedRow(props: AskedRowProps): ReactElement {
  const { question } = props;
  const outcome = question.answer
    ? `You answered: ${question.answer}`
    : CLOSED_LABELS[question.status];
  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: "flex-start", px: 1 }}>
      <HelpOutlined fontSize="sm" color="disabled" sx={{ mt: 0.25 }} />
      <Typography variant="captionMuted" sx={{ flex: 1, minWidth: 0 }}>
        {`${question.prompt} · ${outcome}`}
      </Typography>
      <RelativeTime value={question.createdAt} sx={{ whiteSpace: "nowrap" }} />
    </Stack>
  );
}
