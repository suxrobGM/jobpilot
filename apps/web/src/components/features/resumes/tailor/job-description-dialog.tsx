"use client";

import type { ReactElement } from "react";
import { DialogContentText } from "@mui/material";
import { z } from "zod/v4";
import { useCreateRequest } from "@/components/features/pilot/requests/use-create-request";
import { FormDialog } from "@/components/ui/form";
import { useAppForm } from "@/components/ui/form/tanstack";

const schema = z.object({ jd: z.string().trim().min(1, "Paste a job description or a URL") });

interface JobDescriptionDialogProps {
  open: boolean;
  onClose: () => void;
}

export function JobDescriptionDialog(props: JobDescriptionDialogProps): ReactElement {
  const { open, onClose } = props;
  const request = useCreateRequest();

  const form = useAppForm({
    defaultValues: { jd: "" },
    validators: { onSubmit: schema },
    onSubmit: async ({ value }) => {
      await request.mutateAsync({
        taskType: "resume.tailor",
        payload: { jobDescription: value.jd.trim() },
      });
      handleClose();
    },
  });

  const handleClose = (): void => {
    form.reset();
    onClose();
  };

  return (
    <FormDialog
      open={open}
      title="Tailor for job"
      onClose={handleClose}
      form={form}
      submitLabel="Run /tailor-resume"
      maxWidth="md"
    >
      <DialogContentText>
        Paste the job description (or a URL). The AI will inspect your existing resumes and either
        reuse a close match or create a new tailored variant under the most relevant base.
      </DialogContentText>
      <form.AppField name="jd">
        {(field) => (
          <field.TextField autoFocus multiline minRows={8} placeholder="Paste JD text or a URL" />
        )}
      </form.AppField>
    </FormDialog>
  );
}
