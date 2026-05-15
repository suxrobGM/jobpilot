"use client";

import type { ReactElement } from "react";
import { Stack, TextField, Typography } from "@mui/material";

interface SummarySectionProps {
  value: string;
  onChange: (next: string) => void;
}

export function SummarySection(props: SummarySectionProps): ReactElement {
  const { value, onChange } = props;
  return (
    <Stack spacing={1}>
      <TextField
        fullWidth
        multiline
        minRows={4}
        maxRows={10}
        placeholder="2–3 sentence professional summary tailored to your target roles."
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <Typography variant="captionMuted">
        Keep it short. The tailor-resume skill rewrites this per-job; what you save here is the
        baseline.
      </Typography>
    </Stack>
  );
}
