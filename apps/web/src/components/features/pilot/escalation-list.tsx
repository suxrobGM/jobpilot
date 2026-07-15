"use client";

import type { ReactElement } from "react";
import { pilotChannel } from "@jobpilot/contracts/sse";
import { LinearProgress, Stack, Typography } from "@mui/material";
import { useQueryClient } from "@tanstack/react-query";
import { useApiQuery } from "@/api/hooks";
import { pilotQueries } from "@/api/queries";
import { queryKeys } from "@/api/query-keys";
import { SectionCard } from "@/components/ui/layout";
import { useSseChannel } from "@/lib/sse/client";
import { EscalationCard } from "./escalation-card";

export function EscalationList(): ReactElement {
  const queryClient = useQueryClient();
  const escalations = useApiQuery(pilotQueries.escalations("open"));

  const refresh = (): void => {
    queryClient.invalidateQueries({ queryKey: [...queryKeys.pilot.all, "escalations"] });
  };

  useSseChannel(pilotChannel, null, {
    on: {
      "escalation.created": refresh,
      "escalation.answered": refresh,
    },
  });

  const items = escalations.data ?? [];

  return (
    <SectionCard title="Open escalations">
      {escalations.isLoading ? (
        <LinearProgress />
      ) : items.length === 0 ? (
        <Typography variant="body2Muted">Nothing needs your attention right now.</Typography>
      ) : (
        <Stack spacing={2}>
          {items.map((escalation) => (
            <EscalationCard key={escalation.id} escalation={escalation} />
          ))}
        </Stack>
      )}
    </SectionCard>
  );
}
