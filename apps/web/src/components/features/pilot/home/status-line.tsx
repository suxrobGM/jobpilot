"use client";

import type { ReactElement } from "react";
import type { PilotState } from "@jobpilot/contracts/pilot";
import { Button, Paper, Stack, Typography } from "@mui/material";
import { AgentOnlyButton } from "@/components/ui/buttons";
import { PulseDot } from "@/components/ui/feedback";
import { useAgentAvailable, useAgentDock } from "@/providers/agent-provider";
import { useConfirm } from "@/providers/confirm-provider";
import { formatRelativeTime } from "@/utils/format";
import { hasGoals, idleCaption, PILOT_MODE_LOOK, type PilotMode } from "../pilot-status";
import { useNextWake } from "../use-next-wake";
import { usePilotControls } from "../use-pilot-controls";
import { usePilotStatus } from "../use-pilot-status";

function headline(mode: PilotMode, state: PilotState, caption: string): string {
  const run = state.currentRun;
  if (mode === "working" && run) {
    return `${run.title} · ${formatRelativeTime(run.startedAt)}`;
  }
  if (mode === "off") {
    return hasGoals(state) ? "Paused" : "Write your goals to start";
  }
  return caption ? `${PILOT_MODE_LOOK[mode].label} · ${caption}` : PILOT_MODE_LOOK[mode].label;
}

interface StatusLineProps {
  state: PilotState;
}

/** Is it working, on what, and how far into today's cap; plus Watch and Pause/Resume. */
export function StatusLine(props: StatusLineProps): ReactElement {
  const { state } = props;
  const confirm = useConfirm();
  const controls = usePilotControls();
  const dock = useAgentDock();
  const agentAvailable = useAgentAvailable();
  const { health, pilot, mode } = usePilotStatus(state, controls.isLoading);
  const nextWakeAt = useNextWake(state);
  const look = PILOT_MODE_LOOK[mode];
  const cap = state.instructionsConfig.dailyApplyCap;

  const pause = async (): Promise<void> => {
    const ok = await confirm({
      title: "Pause the pilot?",
      description: "No applying, networking, or posting until you resume it.",
      confirmLabel: "Pause",
    });
    if (ok) {
      await controls.stop();
    }
  };

  return (
    <Paper variant="outlined" sx={{ px: 2, py: 1.5 }}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1.5}
        sx={{ alignItems: { xs: "stretch", sm: "center" } }}
      >
        <Stack direction="row" spacing={1.5} sx={{ flex: 1, minWidth: 0, alignItems: "center" }}>
          <PulseDot tone={look.tone} pulsing={look.pulsing} size="md" />
          <Typography variant="body1Strong" noWrap sx={{ minWidth: 0 }}>
            {headline(mode, state, idleCaption(pilot, nextWakeAt))}
          </Typography>
          <Typography variant="body2Muted" sx={{ whiteSpace: "nowrap" }}>
            {`${state.appliedToday}/${cap} today`}
          </Typography>
        </Stack>
        <Stack direction="row" spacing={1} sx={{ justifyContent: "flex-end" }}>
          {agentAvailable && (
            <Button size="small" onClick={dock.expand}>
              {mode === "offline" ? "Start agent" : "Watch"}
            </Button>
          )}
          {state.running ? (
            <Button
              size="small"
              variant="outlined"
              disabled={controls.isLoading}
              onClick={() => void pause()}
            >
              Pause
            </Button>
          ) : (
            <AgentOnlyButton
              size="small"
              variant="contained"
              tooltip={hasGoals(state) ? "" : "Write the pilot's goals before starting it."}
              disabled={controls.isLoading || health !== "reachable" || !hasGoals(state)}
              onClick={() => void controls.start()}
            >
              Resume
            </AgentOnlyButton>
          )}
        </Stack>
      </Stack>
    </Paper>
  );
}
