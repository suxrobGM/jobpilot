"use client";

import { useState, type ReactElement } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Stack,
  TextField,
} from "@mui/material";
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
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="md">
      <DialogTitle>Tailor for job</DialogTitle>
      <DialogContent>
        <Stack spacing={2}>
          <DialogContentText>
            Paste the job description (or a URL). The AI will inspect your existing resumes and
            either reuse a close match or create a new tailored variant under the most relevant
            base.
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
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSubmit} disabled={!jd.trim()}>
          Run /tailor-resume
        </Button>
      </DialogActions>
    </Dialog>
  );
}
