"use client";

import type { ReactElement } from "react";
import { Stack, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { pilotQueries } from "@/api/queries";
import { SideSection } from "./side-section";

export function SearchesSummary(): ReactElement {
  const searches = useQuery(pilotQueries.searches()).data ?? [];
  return (
    <SideSection
      title="Searches"
      action={<Typography variant="captionMuted">applied / week</Typography>}
    >
      {searches.length === 0 ? (
        <Typography variant="body2Muted">
          None yet. The pilot builds these from your goals.
        </Typography>
      ) : (
        <Stack spacing={0.5}>
          {searches.map((search) => (
            <Stack key={search.id} direction="row" spacing={1}>
              <Typography variant="body2" noWrap sx={{ flex: 1, minWidth: 0 }}>
                {search.query}
              </Typography>
              <Typography variant="body2Muted">{search.appliedThisWeek}</Typography>
            </Stack>
          ))}
        </Stack>
      )}
    </SideSection>
  );
}
