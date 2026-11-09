"use client";

import type { ReactNode } from "react";
import { PendingActions } from "@mui/icons-material";
import { Card, Stack, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { pipelineQueries } from "@/api/queries";
import { LinkButton } from "@/components/ui/buttons";
import { plural } from "@/utils/format";

/** Parked applications are the one stage blocked on the user, so they sit above the tabs. */
export function NeedsYouBanner(): ReactNode {
  // Unfiltered, like the nav badge: a feed filter shouldn't hide parked applications.
  const count = useQuery(pipelineQueries.needsYou()).data?.length ?? 0;
  if (count === 0) {
    return null;
  }
  return (
    // A plain card with an orange icon; amber read as an alarm.
    <Card
      component={Stack}
      direction="row"
      spacing={1.5}
      sx={{ alignItems: "center", px: 2, py: 1.25 }}
    >
      <PendingActions fontSize="md" sx={{ color: "accent.primary" }} />
      <Typography variant="body2" sx={{ flex: 1, minWidth: 0 }}>
        {`${plural(count, "application")} waiting on an answer from you.`}
      </Typography>
      <LinkButton href="/pilot" size="small" variant="contained">
        Answer in Pilot
      </LinkButton>
    </Card>
  );
}
