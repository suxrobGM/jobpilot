"use client";

import type { ReactElement } from "react";
import { Button, Stack } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { pipelineQueries } from "@/api/queries";
import { LinkButton } from "@/components/ui/buttons";
import { EmptyState } from "@/components/ui/feedback";
import { usePaginationParams } from "@/hooks/use-pagination";
import { usePipelineFilters } from "../pipeline-filters";

/** An empty To review points at where more jobs come from instead of ending the page. */
export function ReviewEmpty(): ReactElement {
  const filters = usePipelineFilters();
  const pagination = usePaginationParams();
  const skipped = useQuery(pipelineQueries.counts(filters)).data?.views.notApplied ?? 0;

  return (
    <EmptyState
      title="You're all caught up"
      description="The Pilot adds new matches here each time it searches."
      action={
        <Stack direction="row" spacing={1} sx={{ justifyContent: "center" }}>
          <LinkButton href="/pilot" variant="contained">
            Find more jobs
          </LinkButton>
          {skipped > 0 && (
            <Button onClick={() => pagination.setFilters({ view: "notApplied" })}>
              Review skipped ({skipped})
            </Button>
          )}
        </Stack>
      }
    />
  );
}
