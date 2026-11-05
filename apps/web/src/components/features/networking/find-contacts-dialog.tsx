"use client";

import { type ReactElement, useState } from "react";
import { Button, TextField } from "@mui/material";
import { api } from "@/api/client";
import { useApiMutation } from "@/api/use-api-mutation";
import { FormDialogShell } from "@/components/ui/form";
import { useAgent } from "@/providers/agent-provider";

interface FindContactsDialogProps {
  open: boolean;
  onClose: () => void;
}

/** Outreach that belongs to no job runs on the standing networking campaign. */
export function FindContactsDialog(props: FindContactsDialogProps): ReactElement {
  const { open, onClose } = props;
  const agent = useAgent();
  const [criteria, setCriteria] = useState("");

  const find = useApiMutation(() => api.networking.campaign.post(), {
    onSuccess: ({ id }) => {
      // The skill reads the criteria as one quoted argument.
      const quoted = criteria.trim().replaceAll('"', "'");
      void agent.injectSkill("networking", `"${quoted}" --campaign ${id}`);
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
      onSubmit={() => find.mutate()}
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
