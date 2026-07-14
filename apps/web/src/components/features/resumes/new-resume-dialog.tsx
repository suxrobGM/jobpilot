"use client";

import { type ReactElement, useState } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
} from "@mui/material";
import { useRouter } from "next/navigation";
import { api } from "@/api/client";
import { useApiMutation } from "@/api/hooks";
import { invalidations } from "@/api/query-keys";

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
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>New blank resume</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField
            label="Label"
            placeholder="e.g. Senior Frontend"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            autoFocus
            fullWidth
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          disabled={!label.trim() || create.isPending}
          onClick={() => create.mutate({ label: label.trim() })}
        >
          Create
        </Button>
      </DialogActions>
    </Dialog>
  );
}
