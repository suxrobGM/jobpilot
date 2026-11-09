"use client";

import { type ReactElement, useState } from "react";
import { Button, TextField } from "@mui/material";
import { useCreateRequest } from "@/components/features/pilot/requests/use-create-request";
import { FormDialogShell } from "@/components/ui/form";

interface FindContactsDialogProps {
  open: boolean;
  onClose: () => void;
}

/** Outreach that belongs to no job runs on the standing networking feed. */
export function FindContactsDialog(props: FindContactsDialogProps): ReactElement {
  const { open, onClose } = props;
  const [criteria, setCriteria] = useState("");
  const find = useCreateRequest({
    onSuccess: () => {
      setCriteria("");
      onClose();
    },
  });

  return (
    <FormDialogShell
      open={open}
      title="Find contacts"
      maxWidth="sm"
      onClose={onClose}
      onSubmit={() =>
        find.mutate({ taskType: "networking.find", payload: { criteria: criteria.trim() } })
      }
      submit={
        <Button
          type="submit"
          variant="contained"
          disabled={criteria.trim() === ""}
          loading={find.isPending}
        >
          Find
        </Button>
      }
    >
      <TextField
        autoFocus
        multiline
        minRows={3}
        fullWidth
        label="Who to look for"
        placeholder="e.g. ML engineering managers at robotics startups in Pittsburgh"
        value={criteria}
        onChange={(event) => setCriteria(event.target.value)}
        helperText="The agent finds people who match and drafts an intro to each for you to review."
      />
    </FormDialogShell>
  );
}
