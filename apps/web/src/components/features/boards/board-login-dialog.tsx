"use client";

import type { ReactElement } from "react";
import type { JobBoardPatch } from "@jobpilot/contracts/job-board";
import { Stack } from "@mui/material";
import { z } from "zod/v4";
import type { JobBoardDto } from "@/api/types";
import { FormDialog } from "@/components/ui/form";
import { useAppForm } from "@/components/ui/form/tanstack";

const loginFormSchema = z.object({
  email: z.string().trim(),
  password: z.string(),
});

interface BoardLoginDialogProps {
  board: JobBoardDto;
  open: boolean;
  onClose: () => void;
  onSubmit: (patch: JobBoardPatch) => void;
  submitting?: boolean;
}

/** The only per-profile part of a board is its login; name and URL are catalog-owned. */
export function BoardLoginDialog(props: BoardLoginDialogProps): ReactElement {
  const { board, open, onClose, onSubmit, submitting } = props;
  const form = useAppForm({
    // The stored password never reaches the browser, so the field starts blank.
    defaultValues: { email: board.email ?? "", password: "" },
    validators: { onSubmit: loginFormSchema },
    onSubmit: async ({ value }) => {
      // A blank password keeps the saved one; the API only clears on an explicit null.
      onSubmit({ email: value.email, password: value.password || undefined });
    },
  });

  return (
    <FormDialog
      open={open}
      title={`Login for ${board.name}`}
      onClose={onClose}
      form={form}
      submitting={submitting}
    >
      <Stack direction="row" spacing={2}>
        <form.AppField name="email">{(field) => <field.TextField label="Email" />}</form.AppField>
        <form.AppField name="password">
          {(field) => (
            <field.TextField
              label="Password"
              type="password"
              helperText={board.hasPassword ? "Leave blank to keep the saved password" : undefined}
            />
          )}
        </form.AppField>
      </Stack>
    </FormDialog>
  );
}
