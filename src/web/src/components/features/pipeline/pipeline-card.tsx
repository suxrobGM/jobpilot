"use client";

import type { ReactElement } from "react";
import { Box, Card, CardActionArea, Stack, Typography } from "@mui/material";
import type { PipelineJobDto } from "@/types/api";
import { formatRelativeTime } from "@/utils/format";

interface PipelineCardProps {
  job: PipelineJobDto;
  onClick?: (job: PipelineJobDto) => void;
}

export function PipelineCard(props: PipelineCardProps): ReactElement {
  const { job, onClick } = props;
  const variant = job.stage === "applying" ? "live" : onClick ? "interactive" : "outlined";

  const content = (
    <Box sx={{ padding: 1.5 }}>
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

      {job.resumeVariant && job.stage !== "replied" && (
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

      {job.replySummary && (
        <Box
          sx={(theme) => ({
            mt: 1,
            padding: 0.75,
            borderRadius: theme.radii.xs,
            backgroundColor: `${theme.palette.stages.replied}1A`,
            border: `1px solid ${theme.palette.stages.replied}33`,
            color: theme.palette.stages.replied,
            fontSize: "0.6875rem",
            lineHeight: 1.45,
          })}
        >
          {job.replySummary}
        </Box>
      )}
    </Box>
  );

  return (
    <Card variant={variant}>
      {onClick ? <CardActionArea onClick={() => onClick(job)}>{content}</CardActionArea> : content}
    </Card>
  );
}
