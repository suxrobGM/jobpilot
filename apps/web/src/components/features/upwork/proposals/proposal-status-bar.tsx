"use client";

import type { ReactElement } from "react";
import { Box, Stack, Typography } from "@mui/material";
import { api } from "@/api/client";
import { upworkProposalQueries } from "@/api/queries";
import type { UpdateUpworkProposalRequest, UpworkProposalDto } from "@/api/types";
import { useApiMutation } from "@/api/use-api-mutation";
import { StatusChip, statusOptions } from "@/components/ui/display";
import { SelectField } from "@/components/ui/form";
import { SectionCard } from "@/components/ui/layout";
import { formatAbsoluteTime } from "@/utils/format";

interface ProposalStatusBarProps {
  proposal: UpworkProposalDto;
}

export function ProposalStatusBar(props: ProposalStatusBarProps): ReactElement {
  const { proposal } = props;
  const update = useApiMutation(
    (body: UpdateUpworkProposalRequest) => api.upwork.proposals({ id: proposal.id }).patch(body),
    { invalidate: [upworkProposalQueries.all] },
  );

  return (
    <SectionCard>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ alignItems: "center" }}>
        <StatusChip domain="upworkProposal" value={proposal.status} size="medium" />
        <SelectField
          label="Status"
          value={proposal.status}
          options={statusOptions("upworkProposal")}
          emptyLabel="-"
          onChange={(v) => v && update.mutate({ status: v })}
        />
        {proposal.status === "closed" && (
          <SelectField
            label="Outcome"
            value={proposal.outcome}
            options={statusOptions("upworkOutcome")}
            onChange={(v) => update.mutate({ outcome: v })}
          />
        )}
        <Box sx={{ flex: 1 }} />
        <Typography variant="captionMuted">
          Updated {formatAbsoluteTime(proposal.updatedAt)}
        </Typography>
      </Stack>
    </SectionCard>
  );
}
