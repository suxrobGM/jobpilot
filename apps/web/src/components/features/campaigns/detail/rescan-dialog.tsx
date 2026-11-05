"use client";

import { type ReactElement, useState } from "react";
import { Button, Typography } from "@mui/material";
import { FormDialogShell } from "@/components/ui/form";
import { plural } from "@/utils/format";
import { MinScoreSlider } from "../min-score-slider";

interface RescanDialogProps {
  open: boolean;
  onClose: () => void;
  skippedCount: number;
  defaultMinScore: number;
  pending: boolean;
  onConfirm: (minScore: number) => void;
}

/** Re-scores skipped jobs against a new threshold so ones dropped just below the cutoff come back. */
export function RescanDialog(props: RescanDialogProps): ReactElement {
  const { open, onClose, skippedCount, defaultMinScore, pending, onConfirm } = props;
  const [minScore, setMinScore] = useState(defaultMinScore);

  return (
    <FormDialogShell
      open={open}
      title="Rescan skipped jobs"
      maxWidth="xs"
      onClose={onClose}
      onSubmit={() => onConfirm(minScore)}
      submit={
        <Button type="submit" variant="contained" loading={pending}>
          Rescan
        </Button>
      }
    >
      <Typography variant="body2Muted">
        Re-scores the {plural(skippedCount, "skipped job")} against a new threshold and sets
        eligible ones to <strong>approved</strong> - apply them from the jobs list or with Re-apply
        selected. Lower the threshold to recover jobs dropped just below the cutoff.
      </Typography>
      <MinScoreSlider value={minScore} onChange={setMinScore} />
    </FormDialogShell>
  );
}
