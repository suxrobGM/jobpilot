"use client";

import type { ReactElement } from "react";
import type { ReviewStatus } from "@jobpilot/contracts/email";
import { CloudSync, FormatListBulleted } from "@mui/icons-material";
import { Box, Stack } from "@mui/material";
import { api } from "@/api/client";
import { emailQueries } from "@/api/queries";
import { useApiMutation } from "@/api/use-api-mutation";
import { useCreateRequest } from "@/components/features/pilot/requests/use-create-request";
import { TooltipButton } from "@/components/ui/buttons";
import { FilterToggle, type SelectFieldOption } from "@/components/ui/form";

interface InboxToolbarProps {
  filter: ReviewStatus | null;
  onFilterChange: (next: ReviewStatus | null) => void;
}

const FILTERS: SelectFieldOption<ReviewStatus>[] = [
  { value: "pending", label: "Pending" },
  { value: "auto", label: "Auto" },
  { value: "approved", label: "Approved" },
  { value: "denied", label: "Denied" },
];

export function InboxToolbar(props: InboxToolbarProps): ReactElement {
  const { filter, onFilterChange } = props;
  const request = useCreateRequest();

  const sync = useApiMutation(() => api.email.sync.post(), {
    successMessage: "Inbox synced",
    invalidate: [emailQueries.all],
  });

  return (
    <Stack direction="row" spacing={1.5} sx={{ flexWrap: "wrap", alignItems: "center" }}>
      <TooltipButton
        title="Fetch new mail from Gmail"
        size="small"
        variant="outlined"
        startIcon={<CloudSync />}
        onClick={() => sync.mutate()}
        loading={sync.isPending}
      >
        Sync
      </TooltipButton>
      <TooltipButton
        title="Ask the pilot to classify the pending messages"
        size="small"
        variant="contained"
        startIcon={<FormatListBulleted />}
        loading={request.isPending}
        onClick={() => request.mutate({ taskType: "inbox.review", payload: {} })}
      >
        Scan pending
      </TooltipButton>
      <Box sx={{ ml: { sm: "auto" } }}>
        <FilterToggle
          label="Review status"
          value={filter}
          options={FILTERS}
          onChange={onFilterChange}
        />
      </Box>
    </Stack>
  );
}
