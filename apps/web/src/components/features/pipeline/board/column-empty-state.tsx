"use client";

import type { ReactElement } from "react";
import { Button, Stack, Typography } from "@mui/material";
import type { PipelineStage } from "@/api/types";
import { LinkButton } from "@/components/ui/buttons";
import { usePipelineActions } from "../actions-provider";

interface ColumnEmptyStateProps {
  stage: PipelineStage;
}

export function ColumnEmptyState(props: ColumnEmptyStateProps): ReactElement {
  const { stage } = props;
  const actions = usePipelineActions();

  return (
    <Stack
      spacing={1.5}
      sx={(theme) => ({
        alignItems: "center",
        justifyContent: "center",
        minHeight: 160,
        padding: 2,
        color: theme.palette.text.disabled,
        textAlign: "center",
      })}
    >
      {stage === "queued" && (
        <>
          <Typography variant="captionMuted">Nothing queued.</Typography>
          <Stack direction="row" spacing={1}>
            <Button size="small" variant="outlined" onClick={actions.openAddUrls}>
              Add URLs
            </Button>
            <LinkButton size="small" variant="contained" href="/campaigns/new">
              New campaign…
            </LinkButton>
          </Stack>
        </>
      )}
      {stage === "applying" && (
        <Typography variant="captionMuted">
          No active campaign. Use <strong>Campaign ▾</strong> above to start.
        </Typography>
      )}
      {stage === "submitted" && (
        <Typography variant="captionMuted">Submitted applications will appear here.</Typography>
      )}
      {stage === "interviewing" && (
        <Typography variant="captionMuted">
          Advance an application from its detail page to land it here.
        </Typography>
      )}
    </Stack>
  );
}
