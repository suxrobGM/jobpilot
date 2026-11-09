"use client";

import { type ReactElement, useEffect, useRef } from "react";
import { Box, Stack, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { pilotQueries } from "@/api/queries";
import { EmptyState } from "@/components/ui/feedback";
import { formatSpanBetween } from "@/utils/format";
import { useRunSteps } from "./use-run-steps";

/** The running task as readable steps; works anywhere, unlike the terminal, which needs this computer. */
export function RunSteps(): ReactElement {
  const { data: state } = useQuery(pilotQueries.state());
  const run = state?.currentRun ?? null;
  const steps = useRunSteps(run?.id ?? null);
  const endRef = useRef<HTMLDivElement>(null);

  // Follow the newest step.
  useEffect(() => {
    if (steps.length > 0) {
      endRef.current?.scrollIntoView({ block: "end" });
    }
  }, [steps.length]);

  if (!run) {
    return (
      <EmptyState
        variant="inline"
        title="Nothing running."
        description="When the pilot works on a task, each step shows here as it happens."
      />
    );
  }

  return (
    <Stack spacing={1.5} sx={{ p: 2, minHeight: 0, overflowY: "auto" }}>
      <Typography variant="body1Strong">{run.title}</Typography>
      {steps.length === 0 && (
        <Typography variant="body2Muted">Starting… steps appear as the agent works.</Typography>
      )}
      <Stack component="ol" spacing={0.75} sx={{ listStyle: "none", m: 0, p: 0 }}>
        {steps.map((step) => (
          <Stack
            component="li"
            key={step.id}
            direction="row"
            spacing={1.5}
            sx={{ alignItems: "baseline" }}
          >
            <Typography variant="captionMuted" sx={{ minWidth: 48, textAlign: "right" }}>
              {formatSpanBetween(run.startedAt, step.at)}
            </Typography>
            <Typography variant="body2">{step.label}</Typography>
          </Stack>
        ))}
      </Stack>
      <Box ref={endRef} />
    </Stack>
  );
}
