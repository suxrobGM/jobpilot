"use client";

import type { ReactElement } from "react";
import type { PilotThreadItem, PilotThreadRun } from "@jobpilot/contracts/pilot";
import type { SvgIconComponent } from "@mui/icons-material";
import {
  CheckCircleOutlined,
  ErrorOutlined,
  HourglassEmpty,
  RemoveCircleOutlined,
} from "@mui/icons-material";
import { Card, CardContent, Link, Stack, Typography } from "@mui/material";
import NextLink from "next/link";
import { humanizeIsoInText } from "@/utils/format";
import { campaignHref } from "@/utils/routes";
import { taskTypeLabel } from "../../task-types";

type WorkItem = Extract<PilotThreadItem, { type: "work" }>;

const dayFormat = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });
const timeFormat = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });

interface OutcomeLook {
  icon: SvgIconComponent;
  color: "success" | "error" | "disabled" | "action";
}

const OUTCOME_LOOKS: Record<NonNullable<PilotThreadRun["outcome"]>, OutcomeLook> = {
  done: { icon: CheckCircleOutlined, color: "success" },
  failed: { icon: ErrorOutlined, color: "error" },
  cancelled: { icon: RemoveCircleOutlined, color: "disabled" },
  expired: { icon: RemoveCircleOutlined, color: "disabled" },
};
const RUNNING_LOOK: OutcomeLook = { icon: HourglassEmpty, color: "action" };

/** "Nov 5 · 9:10–9:52 · Apply to job ×3 · Run saved search" */
function headline(item: WorkItem): string {
  const counts = new Map<string, number>();
  for (const run of item.runs) {
    counts.set(run.taskType, (counts.get(run.taskType) ?? 0) + 1);
  }
  const span = `${timeFormat.format(item.startedAt)}–${timeFormat.format(item.endedAt)}`;
  const work = [...counts].map(([taskType, count]) => {
    const label = taskTypeLabel(taskType);
    return count > 1 ? `${label} ×${count}` : label;
  });
  return [dayFormat.format(item.endedAt), span, ...work].join(" · ");
}

/** Job subjects are "<campaignId>:<jobKey>"; other subjects have no page of their own yet. */
function subjectHref(run: PilotThreadRun) {
  if (run.subjectType !== "job" || !run.subjectId) {
    return null;
  }
  const [campaignId] = run.subjectId.split(":");
  return campaignId ? campaignHref(campaignId) : null;
}

interface RunLineProps {
  run: PilotThreadRun;
}

function RunLine(props: RunLineProps): ReactElement {
  const { run } = props;
  const look = run.outcome ? OUTCOME_LOOKS[run.outcome] : RUNNING_LOOK;
  const Icon = look.icon;
  const href = subjectHref(run);
  const summary = humanizeIsoInText(run.summary);
  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: "flex-start" }}>
      <Icon fontSize="sm" color={look.color} sx={{ mt: 0.25, flexShrink: 0 }} />
      <Typography variant="body2" sx={{ minWidth: 0 }}>
        {href ? (
          <Link component={NextLink} href={href} color="inherit">
            {summary}
          </Link>
        ) : (
          summary
        )}
      </Typography>
    </Stack>
  );
}

interface WorkCardProps {
  item: WorkItem;
}

/** A sitting of work: runs less than 20 minutes apart, one line per run. */
export function WorkCard(props: WorkCardProps): ReactElement {
  const { item } = props;
  return (
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={1}>
          <Typography variant="captionMuted">{headline(item)}</Typography>
          {item.runs.map((run) => (
            <RunLine key={run.runId} run={run} />
          ))}
        </Stack>
      </CardContent>
    </Card>
  );
}
