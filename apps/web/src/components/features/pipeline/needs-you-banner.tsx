"use client";

import type { ReactNode } from "react";
import { Alert } from "@mui/material";
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
    <Alert
      severity="warning"
      variant="outlined"
      sx={{ alignItems: "center" }}
      action={
        <LinkButton href="/pilot" color="warning" size="small" variant="contained">
          Answer in Pilot
        </LinkButton>
      }
    >
      {`${plural(count, "application")} waiting on an answer from you.`}
    </Alert>
  );
}
