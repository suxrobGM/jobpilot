"use client";

import type { ReactElement } from "react";
import { Pause } from "@mui/icons-material";
import { Button, type ButtonProps } from "@mui/material";
import { api } from "@/api/client";
import { useApiMutation } from "@/api/hooks";
import { invalidations } from "@/api/query-keys";

interface PauseCampaignButtonProps {
  campaignId: string;
  size?: ButtonProps["size"];
}

export function PauseCampaignButton(props: PauseCampaignButtonProps): ReactElement {
  const { campaignId, size } = props;
  const pause = useApiMutation(
    () => api.campaigns({ id: campaignId }).status.post({ status: "paused", actor: "user" }),
    { successMessage: "Campaign paused", invalidate: invalidations.campaign },
  );

  return (
    <Button
      size={size}
      variant="outlined"
      color="warning"
      startIcon={<Pause fontSize="sm" />}
      loading={pause.isPending}
      onClick={() => pause.mutate()}
    >
      Stop
    </Button>
  );
}
