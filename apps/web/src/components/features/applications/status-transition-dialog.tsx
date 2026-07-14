"use client";

import { type ReactElement, useState } from "react";
import { type ApplicationStatus, STATUSES } from "@jobpilot/contracts/application";
import { Button, MenuItem, TextField } from "@mui/material";
import { STATUS_LABEL } from "@/components/ui/display";
import { FormDialogShell } from "@/components/ui/form";

interface StatusTransitionDialogProps {
  open: boolean;
  currentStatus: ApplicationStatus;
  onClose: () => void;
  onSubmit: (next: { toStatus: ApplicationStatus; note: string | null }) => void;
  submitting?: boolean;
}

export function StatusTransitionDialog(props: StatusTransitionDialogProps): ReactElement {
  const { open, currentStatus, onClose, onSubmit, submitting } = props;
  const [toStatus, setToStatus] = useState<ApplicationStatus>(currentStatus);
  const [note, setNote] = useState("");

  return (
    <FormDialogShell
      open={open}
      title="Update status"
      onClose={onClose}
      onSubmit={() => onSubmit({ toStatus, note: note.trim() || null })}
      submit={
        <Button
          type="submit"
          variant="contained"
          disabled={submitting || toStatus === currentStatus}
        >
          Save
        </Button>
      }
    >
      <TextField
        select
        fullWidth
        label="New status"
        value={toStatus}
        onChange={(e) => setToStatus(e.target.value as ApplicationStatus)}
      >
        {STATUSES.map((s) => (
          <MenuItem key={s} value={s}>
            {STATUS_LABEL[s]}
          </MenuItem>
        ))}
      </TextField>
      <TextField
        label="Note (optional)"
        fullWidth
        multiline
        rows={3}
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
    </FormDialogShell>
  );
}
