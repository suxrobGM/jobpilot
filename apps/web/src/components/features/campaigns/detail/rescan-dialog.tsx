"use client";

import { type ReactElement, useState } from "react";
import { Button, Typography } from "@mui/material";
import { api } from "@/api/client";
import { campaignQueries } from "@/api/queries";
import { type CampaignDetailDto, jobSummary } from "@/api/types";
import { useApiMutation } from "@/api/use-api-mutation";
import { FormDialogShell } from "@/components/ui/form";
import { useAgent } from "@/providers/agent-provider";
import { plural } from "@/utils/format";
import { COMPOSER_DEFAULT_VALUES } from "../composer/form-config";
import { MinScoreSlider } from "../min-score-slider";

interface RescanDialogProps {
  campaign: CampaignDetailDto;
  open: boolean;
  onClose: () => void;
}

/** Re-scores skipped jobs against a new threshold so ones dropped just below the cutoff come back. */
export function RescanDialog(props: RescanDialogProps): ReactElement {
  const { campaign, open, onClose } = props;
  const agent = useAgent();
  const [minScore, setMinScore] = useState(
    campaign.config.minScore ?? COMPOSER_DEFAULT_VALUES.minScore,
  );
  const skippedCount = jobSummary(campaign)?.skipped ?? 0;

  const rescan = useApiMutation(
    () => api.campaigns({ id: campaign.id }).patch({ config: { ...campaign.config, minScore } }),
    {
      invalidate: [campaignQueries.all],
      // On failure the dialog stays open so the threshold isn't lost.
      onSuccess: () => {
        void agent.injectSkill("rescan-skipped", campaign.id);
        onClose();
      },
    },
  );

  return (
    <FormDialogShell
      open={open}
      title="Rescan skipped jobs"
      maxWidth="xs"
      onClose={onClose}
      onSubmit={() => rescan.mutate()}
      submit={
        <Button type="submit" variant="contained" loading={rescan.isPending}>
          Rescan
        </Button>
      }
    >
      <Typography variant="body2Muted">
        Re-scores the {plural(skippedCount, "skipped job")} against a new threshold and sets
        eligible ones to <strong>approved</strong> - apply them from the jobs list or with Re-apply
        selected. Lower the threshold to recover jobs dropped just below the cutoff.
      </Typography>
      <MinScoreSlider value={minScore} onChange={setMinScore} />
    </FormDialogShell>
  );
}
