"use client";

import type { ReactElement } from "react";
import { CloudSync, FormatListBulleted } from "@mui/icons-material";
import { Button, Stack, ToggleButton, ToggleButtonGroup, Tooltip } from "@mui/material";
import { api } from "@/api/client";
import { useApiMutation } from "@/api/hooks";
import type { InboxFilter } from "@/api/queries";
import { queryKeys } from "@/api/query-keys";
import { AgentOnlyButton } from "@/components/ui/buttons";
import { useAgent } from "@/providers/agent-provider";

interface InboxToolbarProps {
  filter: InboxFilter;
  onFilterChange: (next: InboxFilter) => void;
}

const FILTERS: ReadonlyArray<{ key: InboxFilter; label: string }> = [
  { key: "pending", label: "Pending" },
  { key: "auto", label: "Auto" },
  { key: "approved", label: "Approved" },
  { key: "denied", label: "Denied" },
  { key: "all", label: "All" },
];

export function InboxToolbar(props: InboxToolbarProps): ReactElement {
  const { filter, onFilterChange } = props;
  const { injectSkill } = useAgent();

  const sync = useApiMutation(() => api.email.sync.post(), {
    successMessage: "Inbox synced",
    invalidate: [queryKeys.email.all],
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
      <ToggleButtonGroup
        size="small"
        exclusive
        value={filter}
        onChange={(_, next: InboxFilter | null) => {
          if (next !== null) {
            onFilterChange(next);
          }
        }}
        sx={{ ml: { sm: "auto" }, flexWrap: "wrap" }}
      >
        {FILTERS.map((f) => (
          <ToggleButton key={f.key} value={f.key}>
            {f.label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
    </Stack>
  );
}
