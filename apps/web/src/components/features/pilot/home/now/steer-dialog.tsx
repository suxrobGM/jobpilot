"use client";

import { type ReactElement, useState } from "react";
import { Button, TextField } from "@mui/material";
import { api } from "@/api/client";
import { useApiMutation } from "@/api/use-api-mutation";
import { FormDialogShell } from "@/components/ui/form";

interface SteerDialogProps {
  runId: string;
  open: boolean;
  onClose: () => void;
}

/** One line typed into the running task, without stopping it. */
export function SteerDialog(props: SteerDialogProps): ReactElement {
  const { runId, open, onClose } = props;
  const [text, setText] = useState("");
  const steer = useApiMutation(
    (line: string) => api.pilot.runs({ id: runId }).steer.post({ text: line }),
    {
      successMessage: "Sent to the running task.",
      onSuccess: () => {
        setText("");
        onClose();
      },
    },
  );

  return (
    <FormDialogShell
      open={open}
      title="Tell this task"
      maxWidth="sm"
      onClose={onClose}
      onSubmit={() => steer.mutate(text.trim())}
      submit={
        <Button
          type="submit"
          variant="contained"
          disabled={text.trim() === ""}
          loading={steer.isPending}
        >
          Send
        </Button>
      }
    >
      <TextField
        autoFocus
        fullWidth
        label="Message"
        placeholder="e.g. skip the cover letter on this one"
        value={text}
        onChange={(event) => setText(event.target.value.slice(0, 1000))}
        helperText="Typed into the agent's session as one line while it keeps working."
      />
    </FormDialogShell>
  );
}
