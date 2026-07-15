"use client";

import type { ReactElement } from "react";
import { LinearProgress, Stack, Typography } from "@mui/material";
import { SectionCard } from "@/components/ui/layout";
import { EscalationCard } from "./escalation-card";
import { useOpenEscalations } from "./use-open-escalations";

export function EscalationList(): ReactElement {
  const { escalations, isLoading } = useOpenEscalations();

  return (
    <SectionCard title="Open escalations">
      {isLoading ? (
        <LinearProgress />
      ) : escalations.length === 0 ? (
        <Typography variant="body2Muted">Nothing needs your attention right now.</Typography>
      ) : (
        <Stack spacing={2}>
          {escalations.map((escalation) => (
            <EscalationCard key={escalation.id} escalation={escalation} />
          ))}
        </Stack>
      )}
    </SectionCard>
  );
}
