"use client";

import type { ReactElement } from "react";
import type { PipelineBulkInput, PipelineJobView } from "@jobpilot/contracts/pipeline";
import { Check, Close, Schedule } from "@mui/icons-material";
import { Box, ButtonBase, Checkbox, IconButton, Stack, Tooltip, Typography } from "@mui/material";
import type { PipelineJobDto } from "@/api/types";
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

interface QuickActionsProps {
  onAct: (action: BulkAction) => void;
}

function QuickActions(props: QuickActionsProps): ReactElement {
  const { onAct } = props;
  return (
    <Stack
      direction="row"
      className="quick-actions"
      sx={{ opacity: 0.35, transition: "opacity 120ms", flexShrink: 0 }}
    >
      {QUICK_ACTIONS.map(({ action, label, Icon, color }) => (
        <Tooltip key={action} title={label}>
          <IconButton
            size="small"
            color={color}
            aria-label={label}
            onClick={(event) => {
              event.stopPropagation();
              onAct(action);
            }}
          >
            <Icon fontSize="sm" />
          </IconButton>
        </Tooltip>
      ))}
    </Stack>
  );
}

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
    <ButtonBase
      component="div"
      onClick={onOpen}
      sx={{
        width: "100%",
        textAlign: "left",
        display: "flex",
        alignItems: "center",
        gap: 2,
        px: 2,
        py: 1.5,
        borderBottom: 1,
        borderColor: "divider",
        "&:last-of-type": { borderBottom: 0 },
        "&:hover": { bgcolor: "surfaces.elevated" },
        "&:hover .quick-actions": { opacity: 1 },
      }}
    >
      {selected !== null && (
        <Checkbox
          size="small"
          checked={selected}
          onClick={(event) => event.stopPropagation()}
          onChange={onToggle}
          slotProps={{ input: { "aria-label": `Select ${job.title}` } }}
          sx={{ p: 0 }}
        />
      )}
      <ScoreBadge job={job} />
      <Box sx={{ flex: 1, minWidth: 0, opacity: stale ? 0.6 : 1 }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <Typography variant="body2Strong" noWrap>
            {job.title}
          </Typography>
          <CapExemptChip job={job} />
        </Stack>
        <Typography variant="captionMuted" noWrap component="div">
          {metaLine(job, showFeed)}
        </Typography>
        {reason && (
          <Typography variant="caption" color="warning" noWrap component="div">
            {reason}
          </Typography>
        )}
      </Box>
      {!review && <StatusChip domain="job" value={job.status} size="small" />}
      <Stack direction="row" spacing={0.5} sx={{ alignItems: "center", flexShrink: 0 }}>
        {stale && (
          <Tooltip title="Found over a month ago; the posting may be closed">
            <Schedule fontSize="xs" color="warning" />
          </Tooltip>
        )}
        <RelativeTime value={review ? job.createdAt : job.updatedAt} />
      </Stack>
      {review && <QuickActions onAct={onAct} />}
    </ButtonBase>
  );
}
