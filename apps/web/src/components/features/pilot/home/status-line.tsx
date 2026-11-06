"use client";

import { type ReactElement, useState } from "react";
import type { PilotState } from "@jobpilot/contracts/pilot";
import { Button, Paper, Stack, Typography } from "@mui/material";
import { api } from "@/api/client";
import { useApiMutation } from "@/api/use-api-mutation";
import { TooltipButton } from "@/components/ui/buttons";
import { PulseDot } from "@/components/ui/feedback";
import { pilotHandback } from "@/lib/terminal/client";
import { useAgentDrawer } from "@/providers/agent-provider";
import { useConfirm } from "@/providers/confirm-provider";
import { formatRelativeTime } from "@/utils/format";
import { hasGoals, idleCaption, PILOT_MODE_LOOK, type PilotMode } from "../pilot-status";
import { useRunSteps } from "../steps/use-run-steps";
import { useAutopilot } from "../use-autopilot";
import { useNextWake } from "../use-next-wake";
import { usePilotStatus } from "../use-pilot-status";
import { SteerDialog } from "./steer-dialog";

function headline(mode: PilotMode, state: PilotState, caption: string): string {
  const run = state.currentRun;
  if (run) {
    return `${run.title} · ${formatRelativeTime(run.startedAt)}`;
  }
  if (mode === "off") {
    return "Autopilot off · runs only what you ask for";
  }
  const { label } = PILOT_MODE_LOOK[mode];
  return caption && mode === "idle" ? `${label} · ${caption}` : label;
}

interface StatusLineProps {
  state: PilotState;
}

/** Is it working, on what, and how far into today's cap; plus Watch, Interrupt and autopilot. */
export function StatusLine(props: StatusLineProps): ReactElement {
  const { state } = props;
  const confirm = useConfirm();
  const autopilot = useAutopilot();
  const { openDrawer, watchSteps } = useAgentDrawer();
  const [steering, setSteering] = useState(false);
  const { pilot, mode } = usePilotStatus(state);
  const nextWakeAt = useNextWake(state);
  const look = PILOT_MODE_LOOK[mode];
  const run = state.currentRun;
  const latestStep = useRunSteps(run?.id ?? null).at(-1) ?? null;

  const interrupt = useApiMutation(
    (runId: string) => api.pilot.runs({ id: runId }).interrupt.post(),
    { successMessage: "Asked the pilot to stop this task." },
  );
  const handBack = useApiMutation(async () => ({ data: await pilotHandback(), error: null }), {
    successMessage: "Handed the terminal back to the pilot.",
  });

  const pause = async (): Promise<void> => {
    const ok = await confirm({
      title: "Pause autopilot?",
      description:
        "The pilot stops picking work on its own. Anything you ask for in chat or with a button still runs.",
      confirmLabel: "Pause",
    });
    if (ok) {
      autopilot.mutate(false);
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
          <PulseDot tone={look.tone} pulsing={look.pulsing || run !== null} size="md" />
          <Typography variant="body1Strong" noWrap sx={{ minWidth: 0 }}>
            {headline(mode, state, idleCaption(pilot, nextWakeAt))}
          </Typography>
          <Typography variant="body2Muted" sx={{ whiteSpace: "nowrap" }}>
            {`${state.appliedToday}/${state.config.dailyApplyCap} today`}
          </Typography>
        </Stack>
        <Stack direction="row" spacing={1} sx={{ justifyContent: "flex-end", flexWrap: "wrap" }}>
          {mode === "offline" && (
            <Button size="small" onClick={openDrawer}>
              Start agent
            </Button>
          )}
          {/* Steps stream through the API, so a run can be watched from a phone too. */}
          {(mode !== "offline" || run) && (
            <Button size="small" onClick={watchSteps}>
              Watch
            </Button>
          )}
          {mode === "held" && (
            <Button size="small" loading={handBack.isPending} onClick={() => handBack.mutate()}>
              Hand back
            </Button>
          )}
          {run && (
            <>
              <Button size="small" onClick={() => setSteering(true)}>
                Tell this task
              </Button>
              <Button
                size="small"
                color="error"
                loading={interrupt.isPending}
                onClick={() => interrupt.mutate(run.id)}
              >
                Interrupt
              </Button>
            </>
          )}
          {state.autopilot ? (
            <Button
              size="small"
              variant="outlined"
              disabled={autopilot.isPending}
              onClick={() => void pause()}
            >
              Pause
            </Button>
          ) : (
            <TooltipButton
              title={hasGoals(state) ? "" : "Write your goals before turning on autopilot."}
              size="small"
              variant="contained"
              disabled={autopilot.isPending || !hasGoals(state)}
              onClick={() => autopilot.mutate(true)}
            >
              Resume
            </TooltipButton>
          )}
        </Stack>
      </Stack>
      {run && latestStep && (
        <Typography variant="captionMuted" noWrap component="p" sx={{ mt: 0.5, pl: 3.5 }}>
          {latestStep.label}
        </Typography>
      )}
      {run && <SteerDialog runId={run.id} open={steering} onClose={() => setSteering(false)} />}
    </Paper>
  );
}
