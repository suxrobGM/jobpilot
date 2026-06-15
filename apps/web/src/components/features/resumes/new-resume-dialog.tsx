"use client";

import { useState, type ReactElement } from "react";
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
import { apiClient } from "@/api/client";
import { useApiMutation } from "@/api/hooks";
import { queryKeys } from "@/api/query-keys";

interface NewResumeDialogProps {
  open: boolean;
  onClose: () => void;
}

export function NewResumeDialog(props: NewResumeDialogProps): ReactElement {
  const { open, onClose } = props;
  const router = useRouter();
  const [label, setLabel] = useState("");

  const create = useApiMutation<{ id: number }, { label: string }>(
    (vars) => apiClient.post<{ id: number }>("/api/resumes", vars),
    {
      successMessage: "Resume created",
      invalidate: [queryKeys.resume.all, queryKeys.profile.all],
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
