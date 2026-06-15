"use client";

import type { ReactElement } from "react";
import { Box, Card, CardActionArea, Stack, Tooltip, Typography } from "@mui/material";
import type { PipelineJobDto } from "@/api/types";
import { formatRelativeTime } from "@/utils/format";
import { PipelineCardMenu } from "./card-menu";

interface PipelineCardProps {
  job: PipelineJobDto;
  onClick?: (job: PipelineJobDto) => void;
}

export function PipelineCard(props: PipelineCardProps): ReactElement {
  const { job, onClick } = props;
  const variant = job.stage === "applying" ? "live" : onClick ? "interactive" : "outlined";
  const isQueued = job.stage === "queued";
  const showInlineStageSummary = !isQueued && job.stageSummary;

  const body = (
    <Box sx={{ padding: 1.5, paddingRight: 4.5 }}>
      <Typography
        variant="body2"
        sx={{ fontWeight: 500, letterSpacing: "-0.005em", lineHeight: 1.35, mb: 0.5 }}
      >
        {job.role}
      </Typography>
      <Typography variant="captionMuted" sx={{ display: "block" }}>
        {job.company}
        {job.location ? ` · ${job.location}` : ""}
      </Typography>

      <Stack
        direction="row"
        sx={{ alignItems: "center", justifyContent: "space-between", mt: 1.25, gap: 1 }}
      >
        {job.board ? (
          <Box
            component="span"
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
            })}
          >
            {job.board}
          </Box>
        ) : (
          <span />
        )}

        <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
          {typeof job.matchScore === "number" && (
            <Typography
              variant="captionMuted"
              sx={(theme) => ({
                color:
                  job.matchScore && job.matchScore >= 80
                    ? theme.palette.success.main
                    : theme.palette.text.disabled,
              })}
            >
              ★ {job.matchScore}%
            </Typography>
          )}
          <Typography variant="captionMuted">{formatRelativeTime(job.updatedAt)}</Typography>
        </Stack>
      </Stack>

      {job.resumeVariant && job.stage !== "interviewing" && (
        <Typography
          variant="captionMuted"
          sx={(theme) => ({
            display: "block",
            mt: 1,
            paddingTop: 1,
            borderTop: `1px dashed ${theme.palette.line.divider}`,
          })}
        >
          resume · {job.resumeVariant}
        </Typography>
      )}

      {showInlineStageSummary && (
        <Box
          sx={(theme) => {
            const tint =
              job.stage === "interviewing"
                ? theme.palette.stages.interviewing
                : theme.palette.text.secondary;

            return {
              mt: 1,
              padding: 0.75,
              borderRadius: theme.radii.xs,
              backgroundColor: `${tint}1A`,
              border: `1px solid ${tint}33`,
              color: tint,
              fontSize: "0.6875rem",
              lineHeight: 1.45,
            };
          }}
        >
          {job.stageSummary}
        </Box>
      )}
    </Box>
  );

  const content =
    isQueued && job.stageSummary ? (
      <Tooltip title={job.stageSummary} placement="top" enterDelay={400}>
        {body}
      </Tooltip>
    ) : (
      body
    );

  return (
    <Card variant={variant} sx={{ position: "relative" }}>
      {onClick ? <CardActionArea onClick={() => onClick(job)}>{content}</CardActionArea> : content}
      <Box
        sx={{ position: "absolute", top: 4, right: 4, zIndex: 1 }}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <PipelineCardMenu job={job} />
      </Box>
    </Card>
  );
}
