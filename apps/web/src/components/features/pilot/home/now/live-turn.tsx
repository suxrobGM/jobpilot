"use client";

import { type ReactElement, type ReactNode, useState } from "react";
import type { PilotState } from "@jobpilot/contracts/pilot";
import { Button, Stack, Typography } from "@mui/material";
import { api } from "@/api/client";
import { useApiMutation } from "@/api/use-api-mutation";
import { PulseDot } from "@/components/ui/feedback";
import { endPilotHold } from "@/lib/terminal/client";
import { useAgentDrawer } from "@/providers/agent-provider";
import { idleCaption, type PilotMode } from "../../state/pilot-mode";
import { usePilotState } from "../../state/use-pilot-state";
import { usePilotStatus } from "../../state/use-pilot-status";
import { useRunSteps } from "../../steps/use-run-steps";
import { PilotTurn } from "../thread/pilot-turn";
import { SteerDialog } from "./steer-dialog";
import { type Awaiting, useAwaiting } from "./use-awaiting";

type CurrentRun = NonNullable<PilotState["currentRun"]>;

interface RunningLineProps {
  run: CurrentRun;
}

function RunningLine(props: RunningLineProps): ReactElement {
  const { run } = props;
  const { watchSteps } = useAgentDrawer();
  const [steering, setSteering] = useState(false);
  const latestStep = useRunSteps(run.id).at(-1) ?? null;
  const interrupt = useApiMutation(() => api.pilot.runs({ id: run.id }).interrupt.post(), {
    successMessage: "Asked the pilot to stop this task.",
  });
  return (
    <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
      <PulseDot tone="violet" pulsing size="md" />
      <Stack sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2Strong" noWrap>
          {run.title}
        </Typography>
        {latestStep && (
          <Typography variant="captionMuted" noWrap>
            {latestStep.label}
          </Typography>
        )}
      </Stack>
      {/* Steps stream through the API, so a run can be watched from a phone too. */}
      <Button size="small" onClick={watchSteps}>
        Watch
      </Button>
      <Button size="small" onClick={() => setSteering(true)}>
        Tell this task
      </Button>
      <Button
        size="small"
        color="error"
        loading={interrupt.isPending}
        onClick={() => interrupt.mutate()}
      >
        Stop
      </Button>
      <SteerDialog runId={run.id} open={steering} onClose={() => setSteering(false)} />
    </Stack>
  );
}

interface SaidLineProps {
  text: string;
  action?: ReactNode;
}

function SaidLine(props: SaidLineProps): ReactElement {
  const { text, action } = props;
  return (
    <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
      <Typography variant="body2Muted" sx={{ flex: 1, minWidth: 0 }}>
        {text}
      </Typography>
      {action}
    </Stack>
  );
}

type SaidMode = Extract<
  PilotMode,
  "offline" | "outdated" | "unpaired" | "held" | "off" | "starting"
>;

const MODE_LINES: Record<SaidMode, string> = {
  offline: "I'm offline. Start the agent on your computer and I'll pick up where I left off.",
  outdated:
    "The JobPilot app on your computer is out of date, so I can't work. Update it and I'll pick up where I left off.",
  unpaired: "The agent is running but hasn't connected to me yet.",
  held: "You're using the terminal, so I'm holding new work until you hand it back.",
  off: "Autopilot is off, so I only do what you ask.",
  starting: "Starting up.",
};

const AGENT_ACTIONS: Record<"offline" | "outdated" | "unpaired", string> = {
  offline: "Start agent",
  outdated: "Update agent",
  unpaired: "Open agent",
};

const AWAITING_LINES: Record<Awaiting, string> = {
  reply: "Got your message. I'll reply next.",
  request: "Got it. I'll start on what you asked next.",
};

/** The newest line of the thread: what the pilot is doing right now, with the controls for it. */
export function LiveTurn(): ReactElement {
  const state = usePilotState();
  const { openDrawer, watchSteps } = useAgentDrawer();
  const { pilot, mode, nextWakeAt } = usePilotStatus(state);
  const endHold = useApiMutation(async () => ({ data: await endPilotHold(), error: null }), {
    successMessage: "Handed the terminal back to the pilot.",
  });
  const awaiting = useAwaiting();
  const run = state.currentRun;

  const line = (): ReactElement => {
    if (run) {
      return <RunningLine run={run} />;
    }
    // Under an unanswered ask, a status line reads like the reply; offline and held explain the wait.
    const ready =
      mode !== "offline" && mode !== "outdated" && mode !== "unpaired" && mode !== "held";
    if (awaiting && ready) {
      return <SaidLine text={AWAITING_LINES[awaiting]} />;
    }
    switch (mode) {
      case "offline":
      case "outdated":
      case "unpaired":
        return (
          <SaidLine
            text={MODE_LINES[mode]}
            action={
              <Button size="small" variant="contained" onClick={openDrawer}>
                {AGENT_ACTIONS[mode]}
              </Button>
            }
          />
        );
      case "held":
        return (
          <SaidLine
            text={MODE_LINES.held}
            action={
              <Button size="small" loading={endHold.isPending} onClick={() => endHold.mutate()}>
                Hand back
              </Button>
            }
          />
        );
      case "working":
        return (
          <SaidLine
            text="Working."
            action={
              <Button size="small" onClick={watchSteps}>
                Watch
              </Button>
            }
          />
        );
      case "off":
      case "starting":
        return <SaidLine text={MODE_LINES[mode]} />;
      case "idle":
      case "unknown":
        return (
          <SaidLine text={idleCaption(pilot, nextWakeAt) || "Idle. Nothing to do right now."} />
        );
    }
  };

  return <PilotTurn at="Now">{line()}</PilotTurn>;
}
