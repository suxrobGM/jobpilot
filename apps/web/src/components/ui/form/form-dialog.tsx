"use client";

import type { ComponentType, PropsWithChildren, ReactElement, ReactNode } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  type DialogProps,
  Stack,
} from "@mui/material";
import { DialogHeader } from "@/components/ui/feedback";

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
          // React bubbles submit through the portal, so an enclosing page form would submit too.
          e.preventDefault();
          e.stopPropagation();
          onSubmit();
        }}
      >
        <DialogHeader title={title} onClose={onClose} />
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

/** Structural slice of a useAppForm instance - keeps the shell free of form generics. */
interface FormDialogFormApi {
  handleSubmit: () => Promise<void>;
  AppForm: ComponentType<PropsWithChildren>;
  SubmitButton: ComponentType<{ children: ReactNode }>;
}

interface FormDialogProps extends Omit<FormDialogShellProps, "onSubmit" | "submit"> {
  form: FormDialogFormApi;
  submitLabel?: string;
}

export function FormDialog(props: FormDialogProps): ReactElement {
  const { form, submitLabel = "Save", ...shell } = props;

  return (
    <FormDialogShell
      {...shell}
      onSubmit={() => {
        form.handleSubmit();
      }}
      submit={
        <form.AppForm>
          <form.SubmitButton>{submitLabel}</form.SubmitButton>
        </form.AppForm>
      }
    />
  );
}
