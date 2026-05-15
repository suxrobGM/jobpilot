"use client";

import type { ReactElement } from "react";
import { CloudSync, FormatListBulleted } from "@mui/icons-material";
import { Button, Chip, Stack } from "@mui/material";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { apiClient } from "@/lib/api-client";
import { queryKeys } from "@/lib/api/query-keys";
import { useAgent } from "@/providers/agent-provider";
import type { SyncResultDto } from "@/types/api";
import type { InboxFilter } from "./inbox-content";

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
  const { injectSkill, expand } = useAgent();

  const sync = useApiMutation<SyncResultDto, void>(
    () => apiClient.post<SyncResultDto>("/api/email/sync"),
    {
      successMessage: "Inbox synced",
      invalidate: [queryKeys.email.all],
    },
  );

  const handleScan = async (): Promise<void> => {
    expand();
    await injectSkill("scan-inbox");
  };

  return (
    <Stack direction="row" spacing={1.5} sx={{ flexWrap: "wrap", alignItems: "center" }}>
      <Button
        size="small"
        variant="outlined"
        startIcon={<CloudSync />}
        onClick={() => sync.mutate(undefined as unknown as void)}
        disabled={sync.isPending}
      >
        {sync.isPending ? "Syncing…" : "Sync"}
      </Button>
      <Button
        size="small"
        variant="contained"
        startIcon={<FormatListBulleted />}
        onClick={handleScan}
      >
        Scan pending
      </Button>
      <Stack direction="row" spacing={0.5} sx={{ ml: "auto", flexWrap: "wrap" }}>
        {FILTERS.map((f) => (
          <Chip
            key={f.key}
            label={f.label}
            color={filter === f.key ? "primary" : "default"}
            onClick={() => onFilterChange(f.key)}
            variant={filter === f.key ? "filled" : "outlined"}
          />
        ))}
      </Stack>
    </Stack>
  );
}
