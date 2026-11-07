"use client";

import type { ReactNode } from "react";
import type { PipelineFilters } from "@jobpilot/contracts/pipeline";
import { Schedule } from "@mui/icons-material";
import { Alert, Button } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import { pipelineQueries } from "@/api/queries";
import { useApiMutation } from "@/api/use-api-mutation";
import { plural } from "@/utils/format";

interface StaleNoticeProps {
  filters: PipelineFilters;
}

/** Old postings are likely closed; one click sets all of them aside, past the current page. */
export function StaleNotice(props: StaleNoticeProps): ReactNode {
  const { filters } = props;
  const count = useQuery(pipelineQueries.counts(filters)).data?.stale ?? 0;
  const skip = useApiMutation(() => api.pipeline.jobs["skip-stale"].post(filters), {
    invalidate: [pipelineQueries.all],
    successMessage: ({ updated }) => `Skipped ${plural(updated, "old posting")}.`,
  });
  if (count === 0) {
    return null;
  }
  return (
    <Alert
      severity="info"
      variant="outlined"
      icon={<Schedule fontSize="sm" />}
      sx={{ alignItems: "center" }}
      action={
        <Button size="small" loading={skip.isPending} onClick={() => skip.mutate()}>
          {`Skip ${count}`}
        </Button>
      }
    >
      {`${plural(count, "posting")} ${count === 1 ? "is" : "are"} over a month old and may be closed.`}
    </Alert>
  );
}
