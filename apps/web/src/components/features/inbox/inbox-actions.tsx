"use client";

import type { ReactElement } from "react";
import { CloudSync, DeleteSweep, FormatListBulleted } from "@mui/icons-material";
import { Stack } from "@mui/material";
import { api } from "@/api/client";
import { emailQueries } from "@/api/queries";
import { useApiMutation } from "@/api/use-api-mutation";
import { useCreateRequest } from "@/components/features/pilot/requests/use-create-request";
import { TooltipButton } from "@/components/ui/buttons";
import { useConfirm } from "@/providers/confirm-provider";

/** Clear, sync and scan, for the top bar. */
export function InboxActions(): ReactElement {
  const confirm = useConfirm();
  const request = useCreateRequest();

  const sync = useApiMutation(() => api.email.sync.post(), {
    successMessage: "Inbox synced",
    invalidate: [emailQueries.all],
  });

  const clear = useApiMutation(() => api.email.messages.delete(), {
    successMessage: "Inbox cleared",
    invalidate: [emailQueries.all],
  });

  const handleClear = async (): Promise<void> => {
    const confirmed = await confirm({
      title: "Clear inbox?",
      description:
        "Deletes every message not linked to an application. Sync won't bring them back; only newer mail arrives.",
      confirmLabel: "Clear",
      destructive: true,
    });
    if (confirmed) {
      clear.mutate();
    }
  };

  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
      <TooltipButton
        title="Delete messages not linked to an application"
        size="small"
        variant="outlined"
        color="error"
        startIcon={<DeleteSweep />}
        onClick={() => void handleClear()}
        loading={clear.isPending}
      >
        Clear
      </TooltipButton>
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
