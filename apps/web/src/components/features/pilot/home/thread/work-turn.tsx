"use client";

import { type ReactElement, useState } from "react";
import type { PilotThreadRun } from "@jobpilot/contracts/pilot";
import { taskTypeLabel } from "@jobpilot/contracts/pilot";
import type { SvgIconComponent } from "@mui/icons-material";
import {
  CheckCircleOutlined,
  ErrorOutlined,
  HourglassEmpty,
  RemoveCircleOutlined,
  SendOutlined,
} from "@mui/icons-material";
import { Box, Button, Card, Divider, Link, Stack, Typography } from "@mui/material";
import NextLink from "next/link";
import { humanizeIsoInText } from "@/utils/format";
import { pipelineHref } from "@/utils/routes";
import { formatClockSpan, PilotTurn } from "./pilot-turn";
import { isApplied, shownRuns, tallyLine, type WorkItem, workSummary } from "./work-summary";

interface RowLook {
  icon: SvgIconComponent;
  color: "primary" | "success" | "error" | "disabled" | "action";
}

function rowLook(run: PilotThreadRun): RowLook {
  if (isApplied(run)) {
    return { icon: SendOutlined, color: "primary" };
  }
  switch (run.outcome) {
    case "done":
      return { icon: CheckCircleOutlined, color: "success" };
    case "failed":
      return { icon: ErrorOutlined, color: "error" };
    case "cancelled":
    case "expired":
      return { icon: RemoveCircleOutlined, color: "disabled" };
    case null:
      return { icon: HourglassEmpty, color: "action" };
  }
}

/** Job subjects are "<feedId>:<jobKey>"; other subjects have no page of their own yet. */
function subjectHref(run: PilotThreadRun) {
  if (run.subjectType !== "job" || !run.subjectId) {
    return null;
  }
  const [feedId] = run.subjectId.split(":");
  return feedId ? pipelineHref(feedId) : null;
}

interface RunRowProps {
  run: PilotThreadRun;
}

/** A job run leads with the job; anything else with what the task was. */
function RunRow(props: RunRowProps): ReactElement {
  const { run } = props;
  const look = rowLook(run);
  const Icon = look.icon;
  const href = subjectHref(run);
  const name = run.job ? `${run.job.title} · ${run.job.company}` : taskTypeLabel(run.taskType);
  const note = isApplied(run) ? "Applied" : humanizeIsoInText(run.summary);
  return (
    <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", minHeight: 40, px: 2 }}>
      <Icon fontSize="sm" color={look.color} />
      <Typography variant="body2" noWrap title={run.summary} sx={{ flex: 1, minWidth: 0 }}>
        {href ? (
          <Link component={NextLink} href={href} color="inherit" variant="body2Strong">
            {name}
          </Link>
        ) : (
          <Typography component="span" variant="body2Strong">
            {name}
          </Typography>
        )}
        <Typography component="span" variant="body2Muted">{`  ${note}`}</Typography>
      </Typography>
      {run.job?.score != null && <Typography variant="body2Muted">{run.job.score}</Typography>}
    </Stack>
  );
}

/** Past this many results, the rest wait behind "Show more". */
const SHOWN_RESULTS = 4;

interface WorkTurnProps {
  item: WorkItem;
}

/** A sitting of work in the pilot's words, with its results in a card underneath. */
export function WorkTurn(props: WorkTurnProps): ReactElement {
  const { item } = props;
  const [expanded, setExpanded] = useState(false);
  const runs = shownRuns(item);
  const tally = item.searchTally;
  // A lone non-job run with no searches is fully said by the summary sentence.
  const lone = runs.length === 1 && runs[0].job === null && tally === null;
  const showResults = runs.length > 0 && !lone;
  const hidden = expanded ? 0 : Math.max(0, runs.length - SHOWN_RESULTS);
  const visible = hidden > 0 ? runs.slice(0, SHOWN_RESULTS) : runs;
  return (
    <PilotTurn at={formatClockSpan(item.startedAt, item.endedAt)}>
      <Typography variant="body1">{workSummary(item)}</Typography>
      {showResults && (
        <Card sx={{ overflow: "hidden" }}>
          <Stack divider={<Divider />}>
            {visible.map((run) => (
              <RunRow key={run.runId} run={run} />
            ))}
          </Stack>
          {hidden > 0 && (
            <Box sx={{ borderTop: 1, borderColor: "divider", px: 1 }}>
              <Button size="small" color="inherit" onClick={() => setExpanded(true)}>
                {`Show ${hidden} more`}
              </Button>
            </Box>
          )}
          {tally && (
            <Typography
              variant="captionMuted"
              component="p"
              sx={(theme) => ({
                px: 2,
                py: 1,
                borderTop: 1,
                borderColor: "divider",
                backgroundColor: theme.palette.surfaces.panel,
              })}
            >
              {tallyLine(tally)}
            </Typography>
          )}
        </Card>
      )}
    </PilotTurn>
  );
}
