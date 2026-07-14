"use client";

import type { ReactElement } from "react";
import type { AddQueueEntry } from "@jobpilot/contracts/queue";
import { z } from "zod/v4";
import { FormDialog } from "@/components/ui/form";
import { useAppForm } from "@/components/ui/form/tanstack";

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
    <FormDialog
      open={open}
      title="Add URLs to queue"
      onClose={onClose}
      form={form}
      submitting={submitting}
    >
      <form.AppField name="urlsText">
        {(field) => (
          <field.TextField
            label="URLs (one per line)"
            multiline
            rows={6}
            placeholder={"https://www.linkedin.com/jobs/view/...\nhttps://boards.greenhouse.io/..."}
            helperText="Paste one URL per line. Whitespace and commas are accepted."
          />
        )}
      </form.AppField>
      <form.AppField name="note">
        {(field) => <field.TextField label="Note (optional)" />}
      </form.AppField>
    </FormDialog>
  );
}
