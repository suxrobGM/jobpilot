"use client";

import type { ReactElement } from "react";
import { pilotChannel } from "@jobpilot/contracts/sse";
import { Box, LinearProgress, Stack, Typography } from "@mui/material";
import { useQueryClient } from "@tanstack/react-query";
import { useApiQuery } from "@/api/hooks";
import { pilotQueries } from "@/api/queries";
import { queryKeys } from "@/api/query-keys";
import { SectionCard } from "@/components/ui/layout";
import { useSseChannel } from "@/lib/sse/client";
import { PromotionDraftCard, PromotionSummary } from "./promotion-card";

/** Drafts awaiting review render as editable cards; everything else collapses into a compact list. */
export function PromotionList(): ReactElement {
  const queryClient = useQueryClient();
  const query = useApiQuery(pilotQueries.promotions());

  const refresh = (): void => {
    queryClient.invalidateQueries({ queryKey: [...queryKeys.pilot.all, "promotions"] });
  };

  useSseChannel(pilotChannel, null, {
    on: { "promotion.created": refresh, "promotion.updated": refresh },
  });

  if (query.isLoading) {
    return (
      <SectionCard title="Promotions">
        <LinearProgress />
      </SectionCard>
    );
  }

  const promotions = query.data ?? [];
  const drafts = promotions.filter((p) => p.status === "draft");
  const others = promotions.filter((p) => p.status !== "draft");

  return (
    <SectionCard title="Promotions">
      {promotions.length === 0 ? (
        <Typography variant="body2Muted">No promotion posts yet.</Typography>
      ) : (
        <Stack spacing={2}>
          {drafts.map((promotion) => (
            <PromotionDraftCard key={promotion.id} promotion={promotion} />
          ))}
          {others.length > 0 && (
            <Stack spacing={1.5} divider={<Box sx={{ borderTop: 1, borderColor: "divider" }} />}>
              {others.map((promotion) => (
                <PromotionSummary key={promotion.id} promotion={promotion} />
              ))}
            </Stack>
          )}
        </Stack>
      )}
    </SectionCard>
  );
}
