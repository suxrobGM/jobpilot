"use client";

import { type ReactElement, useState } from "react";
import { Button, DialogContentText, TextField } from "@mui/material";
import { FormDialogShell } from "@/components/ui/form";
import { useAgent } from "@/providers/agent-provider";

interface JobDescriptionDialogProps {
  open: boolean;
  onClose: () => void;
}

export function JobDescriptionDialog(props: JobDescriptionDialogProps): ReactElement {
  const { open, onClose } = props;
  const [jd, setJd] = useState("");
  const agent = useAgent();

  const handleClose = () => {
    setJd("");
    onClose();
  };

  const handleSubmit = async () => {
    const arg = jd.trim();
    if (!arg) {
      return;
    }

    await agent.injectSkill("tailor-resume", JSON.stringify(arg));
    handleClose();
  };

  return (
    <FormDialogShell
      open={open}
      title="Tailor for job"
      onClose={handleClose}
      onSubmit={() => void handleSubmit()}
      maxWidth="md"
      submit={
        <Button type="submit" variant="contained" disabled={!jd.trim()}>
          Run /tailor-resume
        </Button>
      }
    >
      <DialogContentText>
        Paste the job description (or a URL). The AI will inspect your existing resumes and either
        reuse a close match or create a new tailored variant under the most relevant base.
      </DialogContentText>
      <TextField
        autoFocus
        fullWidth
        multiline
        minRows={8}
        placeholder="Paste JD text or a URL"
        value={jd}
        onChange={(e) => setJd(e.target.value)}
      />
    </FormDialogShell>
  );
}
