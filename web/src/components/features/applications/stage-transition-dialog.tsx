"use client";

import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
} from "@mui/material";
import { useState, type ReactElement } from "react";
import { STAGES, type Stage } from "@/lib/schemas/application";

const STAGE_LABEL: Record<Stage, string> = {
  applied: "Applied",
  recruiter_screen: "Recruiter screen",
  assessment: "Assessment",
  hiring_manager_screen: "HM screen",
  technical_interview: "Technical",
  onsite: "Onsite",
  offer: "Offer",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};

interface StageTransitionDialogProps {
  open: boolean;
  currentStage: Stage;
  onClose: () => void;
  onSubmit: (next: { toStage: Stage; note: string | null }) => void;
  submitting?: boolean;
}

export function StageTransitionDialog(props: StageTransitionDialogProps): ReactElement {
  const { open, currentStage, onClose, onSubmit, submitting } = props;
  const [toStage, setToStage] = useState<Stage>(currentStage);
  const [note, setNote] = useState("");

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit({ toStage, note: note.trim() || null });
        }}
      >
        <DialogTitle>Update stage</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              select
              label="New stage"
              value={toStage}
              onChange={(e) => setToStage(e.target.value as Stage)}
            >
              {STAGES.map((s) => (
                <MenuItem key={s} value={s}>
                  {STAGE_LABEL[s]}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Note (optional)"
              multiline
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            type="submit"
            variant="contained"
            disabled={submitting || toStage === currentStage}
          >
            Save
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
