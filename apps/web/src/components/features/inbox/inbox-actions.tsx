"use client";

import type { ReactElement } from "react";
import { CloudSync, FormatListBulleted } from "@mui/icons-material";
import { Stack } from "@mui/material";
import { api } from "@/api/client";
import { emailQueries } from "@/api/queries";
import { useApiMutation } from "@/api/use-api-mutation";
import { useCreateRequest } from "@/components/features/pilot/requests/use-create-request";
import { TooltipButton } from "@/components/ui/buttons";

/** Sync and scan, for the top bar. */
export function InboxActions(): ReactElement {
  const request = useCreateRequest();

  const sync = useApiMutation(() => api.email.sync.post(), {
    successMessage: "Inbox synced",
    invalidate: [emailQueries.all],
  });

  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
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
    </Stack>
  );
}
