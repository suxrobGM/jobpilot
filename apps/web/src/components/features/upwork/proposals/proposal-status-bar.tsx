"use client";

import type { ReactElement } from "react";
import { Box, Stack, Typography } from "@mui/material";
import type { UpdateUpworkProposalRequest, UpworkProposalDto } from "@/api/types";
import { ColorChip } from "@/components/ui/display";
import { SelectField } from "@/components/ui/form";
import { SectionCard } from "@/components/ui/layout";
import { OUTCOME_OPTIONS, STATUS_COLOR, STATUS_LABEL, STATUS_OPTIONS } from "./proposal-status";

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
        <ColorChip
          value={proposal.status}
          colors={STATUS_COLOR}
          label={STATUS_LABEL[proposal.status]}
          size="medium"
        />
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
          Updated {new Date(proposal.updatedAt).toLocaleString()}
        </Typography>
      </Stack>
    </SectionCard>
  );
}
