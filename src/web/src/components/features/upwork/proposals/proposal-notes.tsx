"use client";

import { useState, type ReactElement } from "react";
import { Button, Stack, TextField } from "@mui/material";
import { apiClient } from "@/api/client";
import { useApiMutation } from "@/api/hooks";
import { queryKeys } from "@/api/query-keys";
import type { UpdateUpworkProposalRequest, UpworkProposalDto } from "@/api/types";
import { SectionCard } from "@/components/ui/layout";

interface ProposalNotesProps {
  id: number;
  notes: string | null;
}

/** Self-contained private-notes editor: tracks an unsaved draft and persists on demand. */
export function ProposalNotes(props: ProposalNotesProps): ReactElement {
  const { id, notes } = props;
  const [draft, setDraft] = useState<string | null>(null);

  const save = useApiMutation<UpworkProposalDto, UpdateUpworkProposalRequest>(
    (body) => apiClient.patch<UpworkProposalDto>(`/api/upwork/proposals/${id}`, body),
    {
      invalidate: [queryKeys.upworkProposals.all],
      successMessage: "Notes saved",
      onSuccess: () => setDraft(null),
    },
  );

  const value = draft ?? notes ?? "";

  return (
    <SectionCard title="Notes">
      <Stack spacing={1.5} sx={{ alignItems: "flex-start" }}>
        <TextField
          fullWidth
          multiline
          minRows={3}
          placeholder="Private notes about this proposal."
          value={value}
          onChange={(e) => setDraft(e.target.value)}
        />
        <Button
          variant="outlined"
          disabled={draft === null || save.isPending}
          onClick={() => save.mutate({ notes: value })}
        >
          Save notes
        </Button>
      </Stack>
    </SectionCard>
  );
}
