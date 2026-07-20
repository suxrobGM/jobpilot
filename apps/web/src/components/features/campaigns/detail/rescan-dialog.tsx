"use client";

import { type ReactElement, useState } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Slider,
  Stack,
  Typography,
} from "@mui/material";
import { plural } from "@/utils/format";

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
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Rescan skipped jobs</DialogTitle>
      <DialogContent>
        <Stack spacing={1} sx={{ pt: 1 }}>
          <Typography variant="body2Muted">
            Re-scores the {plural(skippedCount, "skipped job")} against a new threshold and sets
            eligible ones to <strong>approved</strong> - apply them from the jobs list or with
            Re-apply selected. Lower the threshold to recover jobs dropped just below the cutoff.
          </Typography>
          <Typography variant="body2">Min match score: {minScore}</Typography>
          <Slider
            value={minScore}
            min={0}
            max={100}
            step={5}
            marks
            valueLabelDisplay="auto"
            onChange={(_, v) => setMinScore(v as number)}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={pending} onClick={() => onConfirm(minScore)}>
          Rescan
        </Button>
      </DialogActions>
    </Dialog>
  );
}
