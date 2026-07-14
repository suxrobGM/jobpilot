"use client";

import { type ReactElement, useState } from "react";
import { Button, TextField } from "@mui/material";
import { useRouter } from "next/navigation";
import { api } from "@/api/client";
import { useApiMutation } from "@/api/hooks";
import { invalidations } from "@/api/query-keys";
import { FormDialogShell } from "@/components/ui/form";

interface NewResumeDialogProps {
  open: boolean;
  onClose: () => void;
}

export function NewResumeDialog(props: NewResumeDialogProps): ReactElement {
  const { open, onClose } = props;
  const router = useRouter();
  const [label, setLabel] = useState("");

  const create = useApiMutation<{ id: string }, { label: string }>(
    (vars) => api.resumes.post(vars),
    {
      successMessage: "Resume created",
      invalidate: invalidations.resume,
      onSuccess: (data) => {
        onClose();
        setLabel("");
        router.push(`/resumes/${data.id}`);
      },
    },
  );

  return (
    <FormDialogShell
      open={open}
      title="New blank resume"
      onClose={onClose}
      onSubmit={() => create.mutate({ label: label.trim() })}
      maxWidth="xs"
      submit={
        <Button type="submit" variant="contained" disabled={!label.trim() || create.isPending}>
          Create
        </Button>
      }
    >
      <TextField
        label="Label"
        placeholder="e.g. Senior Frontend"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        autoFocus
        fullWidth
      />
    </FormDialogShell>
  );
}
