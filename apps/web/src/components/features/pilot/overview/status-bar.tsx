"use client";

import type { ReactElement } from "react";
import type { PilotState } from "@jobpilot/contracts/pilot";
import { Box, Button, Card, CardContent, Chip, Stack, Typography } from "@mui/material";
import { AgentOnlyButton } from "@/components/ui/buttons";
import { StatusChip } from "@/components/ui/display";
import { PulseDot } from "@/components/ui/feedback";
import { type PilotHealth, providerDisplayName } from "@/lib/terminal/client";
import { useConfirm } from "@/providers/confirm-provider";
import { formatRelativeTime, plural } from "@/utils/format";
import {
  hasGoals,
  idleCaption,
  PILOT_HOST_OFFLINE_MESSAGE,
  PILOT_MODE_LOOK,
  type PilotMode,
} from "../pilot-status";
import { AGENT_LABELS, taskTypeAgent, taskTypeLabel } from "../task-types";
import { usePilotControls } from "../use-pilot-controls";
import { usePilotStatus } from "../use-pilot-status";
import { useNextWake } from "./use-next-wake";

function statusDetail(
  mode: PilotMode,
  state: PilotState,
  pilot: PilotHealth | null,
  nextWakeAt: Date | null,
): string {
  const run = state.currentRun;
  switch (mode) {
    case "off":
      return hasGoals(state)
        ? "Start the pilot to run cycles on your local agent."
        : "Write your goals, then start the pilot.";
    case "offline":
      return PILOT_HOST_OFFLINE_MESSAGE;
    case "working":
      if (!run) {
        return "Running a cycle";
      }
      return `${taskTypeLabel(run.taskType)} · ${AGENT_LABELS[taskTypeAgent(run.taskType)]} · for ${formatRelativeTime(run.startedAt)}`;
    case "starting":
      return "The first cycle begins shortly.";
    case "unpaired":
      return "The agent host is up; waiting for the pilot session to connect.";
  }
  return idleCaption(pilot, nextWakeAt);
}

interface StatusBarProps {
  state: PilotState;
}

/** The pilot's one status readout and its Start/Stop control. */
export function StatusBar(props: StatusBarProps): ReactElement {
  const { state } = props;
  const confirm = useConfirm();
  const controls = usePilotControls();
  // Polls fast while Start/Stop is in flight; also ticks the plain-text run and cycle ages.
  const { health, pilot, mode } = usePilotStatus(state, controls.isLoading);
  const nextWakeAt = useNextWake(state);

  const look = PILOT_MODE_LOOK[mode];
  const detail = statusDetail(mode, state, pilot, nextWakeAt);
  const goalsEmpty = !hasGoals(state);
  const timeouts = pilot?.consecutiveTimeouts ?? 0;

  const stopWithConfirm = async (): Promise<void> => {
    const ok = await confirm({
      title: "Stop the pilot?",
      description:
        "The pilot stops running cycles: no applying, networking, or posting until you start it again.",
      confirmLabel: "Stop",
      destructive: true,
    });
    if (ok) {
      await controls.stop();
    }
  };

  const meta = [
    providerDisplayName(controls.provider),
    plural(state.cycleCount, "cycle"),
    state.lastCycleAt && `last ${formatRelativeTime(state.lastCycleAt)} ago`,
  ].filter(Boolean);

  return (
    <Card variant={mode === "working" ? "accent" : undefined}>
      <CardContent>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={2}
          sx={{ alignItems: { xs: "stretch", sm: "center" } }}
        >
          <Stack
            direction="row"
            spacing={1.5}
            sx={{ flex: 1, minWidth: 0, alignItems: "flex-start" }}
          >
            <PulseDot tone={look.tone} pulsing={look.pulsing} size="md" />
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="h5" component="p">
                {look.label}
              </Typography>
              {detail !== "" && <Typography variant="body2Muted">{detail}</Typography>}
              <Stack
                direction="row"
                spacing={1}
                sx={{ mt: 1, alignItems: "center", flexWrap: "wrap", rowGap: 0.5 }}
              >
                <Typography variant="captionMuted">{meta.join(" · ")}</Typography>
                {pilot?.lastCycleStatus && (
                  <StatusChip domain="cycle" value={pilot.lastCycleStatus} />
                )}
                {timeouts > 0 && (
                  <Chip color="warning" variant="outlined" label={plural(timeouts, "timeout")} />
                )}
              </Stack>
            </Box>
          </Stack>
          {state.running ? (
            <Button
              color="error"
              variant="outlined"
              disabled={controls.isLoading}
              onClick={() => void stopWithConfirm()}
            >
              Stop
            </Button>
          ) : (
            <AgentOnlyButton
              variant="contained"
              fullWidth
              tooltip={goalsEmpty ? "Write the pilot's goals before starting it." : ""}
              disabled={controls.isLoading || health !== "reachable" || goalsEmpty}
              onClick={() => void controls.start()}
            >
              Start
            </AgentOnlyButton>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}
