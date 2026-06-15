"use client";

import { useState, type ReactElement, type ReactNode } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Stack,
  TextField,
} from "@mui/material";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  confirmationText?: string;
  confirmationHint?: ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog(props: ConfirmDialogProps): ReactElement {
  const {
    open,
    title,
    description,
    confirmLabel = "Confirm",
    cancelLabel = "Cancel",
    destructive,
    confirmationText,
    confirmationHint,
    onConfirm,
    onCancel,
  } = props;

  const [typed, setTyped] = useState("");

  // Reset the typed confirmation when the dialog closes (adjust state during
  // render rather than in an effect).
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (!open) setTyped("");
  }

  const requiresTyping = Boolean(confirmationText);
  const matches = !requiresTyping || typed.trim() === confirmationText;

  return (
    <Dialog open={open} onClose={onCancel} maxWidth="xs" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Stack spacing={2}>
          <DialogContentText>{description}</DialogContentText>
          {requiresTyping && (
            <>
              {confirmationHint}
              <TextField
                autoFocus
                fullWidth
                size="small"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder={confirmationText}
              />
            </>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>{cancelLabel}</Button>
        <Button
          onClick={onConfirm}
          variant="contained"
          color={destructive ? "error" : "primary"}
          disabled={!matches}
        >
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
