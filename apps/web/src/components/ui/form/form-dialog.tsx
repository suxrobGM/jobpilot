"use client";

import type { ComponentType, PropsWithChildren, ReactElement, ReactNode } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  type DialogProps,
  DialogTitle,
  Stack,
} from "@mui/material";

/** Structural slice of a useAppForm instance — keeps the shell free of form generics. */
interface FormDialogFormApi {
  handleSubmit: () => Promise<void>;
  AppForm: ComponentType<PropsWithChildren>;
  SubmitButton: ComponentType<{ children: ReactNode; disabled?: boolean }>;
}

interface FormDialogProps {
  open: boolean;
  title: string;
  onClose: () => void;
  form: FormDialogFormApi;
  submitLabel?: string;
  cancelLabel?: string;
  submitting?: boolean;
  maxWidth?: DialogProps["maxWidth"];
  children: ReactNode;
}

export function FormDialog(props: FormDialogProps): ReactElement {
  const {
    open,
    title,
    onClose,
    form,
    submitLabel = "Save",
    cancelLabel = "Cancel",
    submitting,
    maxWidth = "sm",
    children,
  } = props;

  return (
    <Dialog open={open} onClose={onClose} maxWidth={maxWidth} fullWidth>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          form.handleSubmit();
        }}
      >
        <DialogTitle>{title}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {children}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>{cancelLabel}</Button>
          <form.AppForm>
            <form.SubmitButton disabled={submitting}>{submitLabel}</form.SubmitButton>
          </form.AppForm>
        </DialogActions>
      </form>
    </Dialog>
  );
}
