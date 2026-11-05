"use client";

import type { ReactElement } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod/v4";
import { api } from "@/api/client";
import { useApiMutation } from "@/api/hooks";
import { invalidations } from "@/api/queries";
import { FormDialog } from "@/components/ui/form";
import { useAppForm } from "@/components/ui/form/tanstack";

const schema = z.object({ label: z.string().trim().min(1, "Give the resume a label") });

interface NewResumeDialogProps {
  open: boolean;
  onClose: () => void;
}

export function NewResumeDialog(props: NewResumeDialogProps): ReactElement {
  const { open, onClose } = props;
  const router = useRouter();

  const create = useApiMutation((label: string) => api.resumes.post({ label }), {
    successMessage: "Resume created",
    invalidate: invalidations.resume,
    onSuccess: (data) => {
      onClose();
      form.reset();
      router.push(`/resumes/${data.id}`);
    },
  });

  const form = useAppForm({
    defaultValues: { label: "" },
    validators: { onSubmit: schema },
    onSubmit: async ({ value }) => {
      await create.mutateAsync(value.label.trim());
    },
  });

  return (
    <FormDialog
      open={open}
      title="New blank resume"
      onClose={onClose}
      form={form}
      submitting={create.isPending}
      submitLabel="Create"
      maxWidth="xs"
    >
      <form.AppField name="label">
        {(field) => <field.TextField label="Label" placeholder="e.g. Senior Frontend" autoFocus />}
      </form.AppField>
    </FormDialog>
  );
}
