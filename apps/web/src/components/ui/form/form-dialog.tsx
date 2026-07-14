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

interface FormDialogShellProps {
  open: boolean;
  title: string;
  onClose: () => void;
  onSubmit: () => void;
  /** The submit control, rendered beside Cancel - it must be `type="submit"`. */
  submit: ReactNode;
  maxWidth?: DialogProps["maxWidth"];
  children: ReactNode;
}

/** Dialog + form + Cancel/submit actions. Use FormDialog for a useAppForm instance. */
export function FormDialogShell(props: FormDialogShellProps): ReactElement {
  const { open, title, onClose, onSubmit, submit, maxWidth = "sm", children } = props;

  return (
    <Dialog open={open} onClose={onClose} maxWidth={maxWidth} fullWidth>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        <DialogTitle>{title}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {children}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          {submit}
        </DialogActions>
      </form>
    </Dialog>
  );
}

/** Structural slice of a useAppForm instance — keeps the shell free of form generics. */
interface FormDialogFormApi {
  handleSubmit: () => Promise<void>;
  AppForm: ComponentType<PropsWithChildren>;
  SubmitButton: ComponentType<{ children: ReactNode; disabled?: boolean }>;
}

interface FormDialogProps extends Omit<FormDialogShellProps, "onSubmit" | "submit"> {
  form: FormDialogFormApi;
  submitting?: boolean;
}

export function FormDialog(props: FormDialogProps): ReactElement {
  const { form, submitting, ...shell } = props;

  return (
    <FormDialogShell
      {...shell}
      onSubmit={() => {
        form.handleSubmit();
      }}
      submit={
        <form.AppForm>
          <form.SubmitButton disabled={submitting}>Save</form.SubmitButton>
        </form.AppForm>
      }
    />
  );
}
