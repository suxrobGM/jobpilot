"use client";

import type { ReactElement } from "react";
import { Box, Stack, Typography } from "@mui/material";
import { PIPELINE_STAGE_LABEL, type PipelineStage } from "@/api/types";

interface ColumnHeaderProps {
  stage: PipelineStage;
  total: number;
  todayCount: number;
  sharedNote: string | null;
}

export function ColumnHeader(props: ColumnHeaderProps): ReactElement {
  const { stage, total, todayCount, sharedNote } = props;

  return (
    <Stack
      direction="row"
      sx={(theme) => ({
        alignItems: "center",
        justifyContent: "space-between",
        paddingInline: 1.5,
        paddingBlock: 1,
        borderBottom: `1px solid ${theme.palette.line.divider}`,
        gap: 1,
      })}
    >
      <Stack direction="row" spacing={1} sx={{ alignItems: "center", minWidth: 0, flex: 1 }}>
        <StageDot stage={stage} />
        <Typography variant="h6" sx={{ fontSize: "0.8125rem", fontWeight: 500 }}>
          {PIPELINE_STAGE_LABEL[stage]}
        </Typography>
        {sharedNote && <SourceNoteChip note={sharedNote} />}
      </Stack>
      <Stack direction="row" spacing={0.75} sx={{ alignItems: "baseline", flexShrink: 0 }}>
        <Typography
          variant="captionMuted"
          sx={(theme) => ({ color: theme.palette.text.secondary })}
        >
          {total}
        </Typography>
        {todayCount > 0 && <Typography variant="captionMuted">· {todayCount} today</Typography>}
      </Stack>
    </Stack>
  );
}

function StageDot(props: { stage: PipelineStage }): ReactElement {
  const pulse = props.stage === "applying";
  return (
    <Box
      sx={(theme) => ({
        width: 7,
        height: 7,
        borderRadius: "50%",
        backgroundColor: theme.palette.stages[props.stage],
        boxShadow: pulse ? `0 0 0 3px ${theme.palette.stages.applying}33` : "none",
        animation: pulse ? "stage-dot-pulse 2.4s ease-in-out infinite" : "none",
        "@keyframes stage-dot-pulse": {
          "0%, 100%": { opacity: 1 },
          "50%": { opacity: 0.45 },
        },
        flexShrink: 0,
      })}
    />
  );
}

function SourceNoteChip(props: { note: string }): ReactElement {
  return (
    <Box
      component="span"
      title={props.note}
      sx={(theme) => ({
        display: "inline-block",
        paddingInline: 0.75,
        paddingBlock: "1px",
        borderRadius: theme.radii.xs,
        border: `1px solid ${theme.palette.line.divider}`,
        fontFamily: "var(--font-jetbrains-mono), monospace",
        fontSize: "0.625rem",
        color: theme.palette.text.secondary,
        backgroundColor: theme.palette.surfaces.elevated,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        maxWidth: 140,
      })}
    >
      {props.note}
    </Box>
  );
}
