"use client";

import type { ReactElement } from "react";
import type { PilotState, TaskList } from "@jobpilot/contracts/pilot";
import { ExpandLess, ExpandMore } from "@mui/icons-material";
import { Box, Collapse, IconButton, Typography } from "@mui/material";
import { useApiQuery } from "@/api/hooks";
import { pilotQueries } from "@/api/queries";
import { SectionCard } from "@/components/ui/layout";
import { usePersistedBoolean } from "@/hooks/use-persisted-boolean";
import type { PilotHealth } from "@/lib/terminal";
import { formatRelativeTime, humanizeIsoInText } from "@/utils/format";
import { idleCaption, PILOT_MODE_LOOK, type PilotMode } from "../pilot-status";
import { taskTypeAgent, taskTypeLabel } from "../task-types";
import { AgentList, type Stage, StageArrow, StageCard } from "./stage-card";
import { useTaskList } from "./task-list-preview";

const HOST: Stage = { title: "Host", role: "Checks for work", tone: "blue" };
const SERVER: Stage = { title: "Server", role: "Picks a task", tone: "peach" };
const SESSION: Stage = { title: "Session", role: "Runs the task", tone: "violet" };
const JOURNAL: Stage = { title: "Journal", role: "Records the outcome", tone: "green" };

const EMPTY_REASON_CAPTIONS: Record<NonNullable<TaskList["emptyReason"]>, string> = {
  capReached: "Daily cap reached",
  awaitingSetup: "Waiting for your goals",
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
  return EMPTY_REASON_CAPTIONS[taskList?.emptyReason ?? "clear"];
}

interface OrchestrationPanelProps {
  state: PilotState;
  pilot: PilotHealth | null;
  mode: PilotMode;
  nextWakeAt: Date | null;
}

export function OrchestrationPanel(props: OrchestrationPanelProps): ReactElement {
  const { state, pilot, mode, nextWakeAt } = props;
  const journal = useApiQuery(pilotQueries.journal());
  const taskList = useTaskList(state.running);
  const [collapsed, setCollapsed] = usePersistedBoolean(
    "jobpilot:pilot-orchestration-collapsed",
    false,
  );

  const { dimmed } = PILOT_MODE_LOOK[mode];
  const working = mode === "working";
  const run = dimmed ? null : state.currentRun;
  const running = run !== null;
  const branch = run ? taskTypeAgent(run.taskType) : null;

  // A run's id is the cycleId of the action it posts.
  const journalItems = journal.data?.items ?? [];
  const posted = run
    ? (journalItems.find((entry) => entry.kind === "action" && entry.cycleId === run.id) ?? null)
    : null;
  const journalCaption = posted
    ? truncate(humanizeIsoInText(posted.summary))
    : `${state.appliedToday} / ${state.instructionsConfig.dailyApplyCap} applied today`;
  const sessionCaption = run
    ? `${taskTypeLabel(run.taskType)} · running ${formatRelativeTime(run.startedAt)}`
    : "Idle";

  return (
    <SectionCard
      title="Orchestration"
      description="How the pilot works a cycle, live."
      actions={
        <IconButton
          aria-label={collapsed ? "Expand orchestration" : "Collapse orchestration"}
          aria-expanded={!collapsed}
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? <ExpandMore /> : <ExpandLess />}
        </IconButton>
      }
    >
      <Collapse in={!collapsed}>
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
          <StageCard
            stage={JOURNAL}
            caption={journalCaption}
            active={posted !== null}
            dimmed={dimmed}
          />
        </Box>
        <Box sx={{ mt: 2 }}>
          <AgentList branch={branch} dimmed={dimmed} />
        </Box>
        <Box sx={{ mt: 1.5 }}>
          <Typography variant="captionMuted">
            Each cycle the host checks for work, the server picks one task, and the pilot session
            hands it to one agent or does it directly.
          </Typography>
        </Box>
      </Collapse>
    </SectionCard>
  );
}
