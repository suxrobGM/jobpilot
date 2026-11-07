"use client";

import type { ReactElement } from "react";
import type { PipelineBulkInput, PipelineJobView } from "@jobpilot/contracts/pipeline";
import { Check, Close, Schedule } from "@mui/icons-material";
import { IconButton, Stack, Tooltip, Typography } from "@mui/material";
import type { PipelineJobDto } from "@/api/types";
import { ListRow } from "@/components/ui/data";
import { RelativeTime, StatusChip } from "@/components/ui/display";
import { CapExemptChip } from "./cap-exempt-chip";
import { ScoreBadge } from "./score-badge";

type BulkAction = PipelineBulkInput["action"];

function metaLine(job: PipelineJobDto, showFeed: boolean): string {
  const parts = [job.company, job.location, job.salary, showFeed && `via ${job.feed.name}`];
  return parts.filter(Boolean).join(" · ");
}

const QUICK_ACTIONS = [
  { action: "skip", label: "Skip", Icon: Close, color: "default" },
  { action: "approve", label: "Approve", Icon: Check, color: "success" },
] as const;

interface JobRowProps {
  job: PipelineJobDto;
  view: PipelineJobView;
  showFeed: boolean;
  /** Null when the view has no bulk action, so no checkbox. */
  selected: boolean | null;
  onToggle: () => void;
  onOpen: () => void;
  onAct: (action: BulkAction) => void;
}

export function JobRow(props: JobRowProps): ReactElement {
  const { job, view, showFeed, selected, onToggle, onOpen, onAct } = props;
  const review = view === "review";
  const stale = review && job.stale;
  const reason = review ? null : (job.failReason ?? job.skipReason);

  return (
    <ListRow
      onOpen={onOpen}
      selection={selected === null ? null : { selected, onToggle, label: job.title }}
      lead={<ScoreBadge job={job} />}
      title={job.title}
      tags={<CapExemptChip job={job} />}
      meta={metaLine(job, showFeed)}
      note={
        reason && (
          <Typography variant="captionMuted" noWrap component="div">
            {reason}
          </Typography>
        )
      }
      dimmed={stale}
      actions={
        review &&
        QUICK_ACTIONS.map(({ action, label, Icon, color }) => (
          <Tooltip key={action} title={label}>
            <IconButton size="small" color={color} aria-label={label} onClick={() => onAct(action)}>
              <Icon fontSize="sm" />
            </IconButton>
          </Tooltip>
        ))
      }
      status={!review && <StatusChip domain="job" value={job.status} size="small" />}
      time={
        <Stack
          direction="row"
          spacing={0.5}
          sx={{ alignItems: "center", justifyContent: "flex-end" }}
        >
          {stale && (
            <Tooltip title="Found over a month ago; the posting may be closed">
              <Schedule fontSize="xs" color="warning" />
            </Tooltip>
          )}
          <RelativeTime value={review ? job.createdAt : job.updatedAt} />
        </Stack>
      }
    />
  );
}
