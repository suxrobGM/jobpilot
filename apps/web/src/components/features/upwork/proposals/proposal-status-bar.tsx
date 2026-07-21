"use client";

import type { ReactElement } from "react";
import { Box, Stack, Typography } from "@mui/material";
import type { UpdateUpworkProposalRequest, UpworkProposalDto } from "@/api/types";
import { SelectField } from "@/components/ui/form";
import { SectionCard } from "@/components/ui/layout";
import { formatAbsoluteTime } from "@/utils/format";
import { OUTCOME_OPTIONS, STATUS_OPTIONS } from "./proposal-status";
import { ProposalStatusChip } from "./proposal-status-chip";

interface ProposalStatusBarProps {
  proposal: UpworkProposalDto;
  onChange: (patch: UpdateUpworkProposalRequest) => void;
}

/** Status chip + status/outcome selectors + last-updated stamp for a proposal. */
export function ProposalStatusBar(props: ProposalStatusBarProps): ReactElement {
  const { proposal, onChange } = props;
  return (
    <SectionCard>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ alignItems: "center" }}>
        <ProposalStatusChip status={proposal.status} size="medium" />
        <SelectField
          label="Status"
          value={proposal.status}
          options={STATUS_OPTIONS}
          emptyLabel="-"
          onChange={(v) => v && onChange({ status: v })}
        />
        {proposal.status === "closed" && (
          <SelectField
            label="Outcome"
            value={proposal.outcome}
            options={OUTCOME_OPTIONS}
            onChange={(v) => onChange({ outcome: v })}
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
