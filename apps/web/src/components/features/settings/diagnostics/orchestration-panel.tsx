"use client";

import type { ReactElement } from "react";
import type { PilotState, TaskList } from "@jobpilot/contracts/pilot";
import { taskTypeAgent, taskTypeLabel } from "@jobpilot/contracts/pilot";
import { Box, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { pilotQueries } from "@/api/queries";
import { SectionCard } from "@/components/ui/layout";
import type { PilotHealth } from "@/lib/terminal/client";
import { formatRelativeTime, formatTimeUntil, humanizeIsoInText } from "@/utils/format";
import { idleCaption, PILOT_MODE_LOOK, type PilotMode } from "../../pilot/state/pilot-mode";
import { usePilotStatus } from "../../pilot/state/use-pilot-status";
import { AgentList } from "./agent-list";
import { type Stage, StageArrow, StageCard } from "./stage-card";
import { RefreshTaskListButton, TaskQueue } from "./task-queue";
import { useTaskList } from "./use-task-list";

const HOST: Stage = { title: "Host", role: "Checks for work", tone: "info" };
const SERVER: Stage = { title: "Server", role: "Picks a task", tone: "warning" };
const SESSION: Stage = { title: "Session", role: "Runs the task", tone: "primary" };
const RESULT: Stage = { title: "Result", role: "Records the outcome", tone: "success" };

const EMPTY_REASON_CAPTIONS: Record<NonNullable<TaskList["emptyReason"]>, string> = {
  capReached: "Daily cap reached",
  awaitingSetup: "No searches yet",
  autopilotOff: "Autopilot off",
  clear: "Nothing to do",
};

function truncate(text: string, max = 48): string {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

function hostCaption(mode: PilotMode, pilot: PilotHealth | null, nextWakeAt: Date | null): string {
  if (mode === "working") {
    return "Running a cycle";
  }
  if (mode === "idle" || mode === "unknown") {
    return idleCaption(pilot, nextWakeAt) || "Idle";
  }
  return PILOT_MODE_LOOK[mode].label;
}

function serverCaption(taskList: TaskList | null | undefined): string {
  const next = taskList?.tasks[0];
  if (next) {
    return `Up next · ${truncate(next.title)}`;
  }
  const reason = taskList?.emptyReason ?? "clear";
  if (reason === "capReached" && taskList) {
    return `Daily cap reached · resets in ${formatTimeUntil(taskList.budget.resetsAt)}`;
  }
  return EMPTY_REASON_CAPTIONS[reason];
}

interface OrchestrationPanelProps {
  state: PilotState;
}

export function OrchestrationPanel(props: OrchestrationPanelProps): ReactElement {
  const { state } = props;
  const { pilot, mode, nextWakeAt } = usePilotStatus(state);
  const latest = useQuery(pilotQueries.runHistory([], { page: 1, limit: 1 }));
  const taskList = useTaskList();

  const { dimmed } = PILOT_MODE_LOOK[mode];
  const working = mode === "working";
  const run = dimmed ? null : state.currentRun;
  const running = run !== null;
  const activeAgent = run ? taskTypeAgent(run.taskType) : null;

  const lastSummary = latest.data?.items[0]?.summary ?? null;
  const resultCaption = lastSummary
    ? truncate(humanizeIsoInText(lastSummary))
    : `${state.appliedToday} / ${state.config.dailyApplyCap} applied today`;
  const sessionCaption = run
    ? `${taskTypeLabel(run.taskType)} · running ${formatRelativeTime(run.startedAt)}`
    : "Idle";

  return (
    <SectionCard
      title="Orchestration"
      description="How the pilot works a cycle, live."
      actions={<RefreshTaskListButton busy={taskList.isFetching} />}
    >
      <Box
        sx={{
          display: "flex",
          flexDirection: { xs: "column", md: "row" },
          alignItems: "stretch",
        }}
      >
        <StageCard
          stage={HOST}
          caption={hostCaption(mode, pilot, nextWakeAt)}
          active={working && !run}
          dimmed={dimmed}
        />
        <StageArrow lit={working} />
        <StageCard stage={SERVER} caption={serverCaption(taskList.data)} dimmed={dimmed} />
        <StageArrow lit={running} />
        <StageCard stage={SESSION} caption={sessionCaption} active={running} dimmed={dimmed} />
        <StageArrow lit={running} />
        <StageCard stage={RESULT} caption={resultCaption} dimmed={dimmed} />
      </Box>
      <TaskQueue taskList={taskList.data} />
      <Box sx={{ mt: 2 }}>
        <AgentList activeAgent={activeAgent} dimmed={dimmed} />
      </Box>
      <Box sx={{ mt: 1.5 }}>
        <Typography variant="captionMuted">
          Each cycle the host checks for work, the server picks one task, and the pilot session
          hands it to one agent or does it directly.
        </Typography>
      </Box>
    </SectionCard>
  );
}
