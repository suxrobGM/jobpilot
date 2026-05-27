"use client";

import type { ReactElement } from "react";
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack } from "@mui/material";
import { z } from "zod/v4";
import { useAppForm } from "@/components/ui/form/tanstack";
import type { AddQueueEntry } from "@/lib/schemas/queue";

interface AddUrlsDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: AddQueueEntry) => void;
  submitting?: boolean;
}

interface FormValues {
  urlsText: string;
  note: string;
}

const EMPTY: FormValues = { urlsText: "", note: "" };

function parseUrls(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const token of raw.split(/[\s,]+/)) {
    const t = token.trim();
    if (!t || seen.has(t)) {
      continue;
    }
    seen.add(t);
    out.push(t);
  }
  return out;
}

const urlsTextSchema = z.string().refine(
  (raw) => {
    const urls = parseUrls(raw);
    if (urls.length === 0) {
      return false;
    }
    return urls.every((u) => z.url().safeParse(u).success);
  },
  { message: "Enter at least one valid URL, one per line" },
);

const formSchema = z.object({
  urlsText: urlsTextSchema,
  note: z.string(),
});

export function AddUrlsDialog(props: AddUrlsDialogProps): ReactElement {
  const { open, onClose, onSubmit, submitting } = props;

  const form = useAppForm({
    defaultValues: EMPTY,
    validators: { onSubmit: formSchema },
    onSubmit: async ({ value }) => {
      const urls = parseUrls(value.urlsText);
      const note = value.note.trim();
      onSubmit({ urls, note: note ? note : null });
    },
  });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          form.handleSubmit();
        }}
      >
        <DialogTitle>Add URLs to queue</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <form.AppField name="urlsText">
              {(field) => (
                <field.TextField
                  label="URLs (one per line)"
                  multiline
                  rows={6}
                  placeholder={
                    "https://www.linkedin.com/jobs/view/...\nhttps://boards.greenhouse.io/..."
                  }
                  helperText="Paste one URL per line. Whitespace and commas are accepted."
                />
              )}
            </form.AppField>
            <form.AppField name="note">
              {(field) => <field.TextField label="Note (optional)" />}
            </form.AppField>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <form.AppForm>
            <form.SubmitButton disabled={submitting}>Save</form.SubmitButton>
          </form.AppForm>
        </DialogActions>
      </form>
    </Dialog>
  );
}
