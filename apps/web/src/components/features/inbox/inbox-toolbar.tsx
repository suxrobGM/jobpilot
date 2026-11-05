"use client";

import type { ReactElement } from "react";
import type { ReviewStatus } from "@jobpilot/contracts/email";
import { CloudSync, FormatListBulleted } from "@mui/icons-material";
import { Box, Button, Stack, Tooltip } from "@mui/material";
import { api } from "@/api/client";
import { useApiMutation } from "@/api/hooks";
import { emailQueries } from "@/api/queries";
import { AgentOnlyButton } from "@/components/ui/buttons";
import { FilterToggle, type SelectFieldOption } from "@/components/ui/form";
import { useAgent } from "@/providers/agent-provider";

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
  const { injectSkill } = useAgent();

  const sync = useApiMutation(() => api.email.sync.post(), {
    successMessage: "Inbox synced",
    invalidate: [emailQueries.all],
  });

  const handleScan = async (): Promise<void> => {
    await injectSkill("scan-inbox");
  };

  return (
    <Stack direction="row" spacing={1.5} sx={{ flexWrap: "wrap", alignItems: "center" }}>
      <Tooltip title="Fetch new mail from Gmail">
        <Button
          size="small"
          variant="outlined"
          startIcon={<CloudSync />}
          onClick={() => sync.mutate()}
          loading={sync.isPending}
        >
          Sync
        </Button>
      </Tooltip>
      <AgentOnlyButton
        size="small"
        variant="contained"
        startIcon={<FormatListBulleted />}
        onClick={handleScan}
        tooltip="Run the scan-inbox skill to classify pending messages"
      >
        Scan pending
      </AgentOnlyButton>
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
