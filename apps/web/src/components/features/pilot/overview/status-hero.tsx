"use client";

import type { ReactElement } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Grid,
  LinearProgress,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import { ColorChip, RelativeTime, StatCard } from "@/components/ui/display";
import { SectionCard } from "@/components/ui/layout";
import { CYCLE_STATUS_COLOR, providerDisplayName } from "@/lib/terminal";
import { useConfirm } from "@/providers/confirm-provider";
import { formatTimeUntil } from "@/utils/format";
import { isHostOffline, PILOT_HOST_OFFLINE_MESSAGE, PILOT_STARTING_UP_LABEL } from "../host-status";
import { usePilotStatus } from "./pilot-status-context";
import { useNextWake } from "./use-next-wake";

/** State + controls on the left, today's budget on the right; the one card that answers "is it working?". */
export function StatusHero(): ReactElement {
  const { state, controls, health, hostStatus } = usePilotStatus();
  const confirm = useConfirm();
  const nextWakeAt = useNextWake();

  const pilot = hostStatus?.pilot ?? null;
  const running = state.running;
  const goalsEmpty = state.instructionsGoals.trim() === "";
  const { dailyApplyCap, dailyNetworkingCap, minScore, networkingEnabled } =
    state.instructionsConfig;
  const { appliedToday, capReached } = state;
  const progress = dailyApplyCap > 0 ? Math.min(100, (appliedToday / dailyApplyCap) * 100) : 0;

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

  return (
    <SectionCard
      title="Pilot"
      description="Autonomous mode runs cycles on your local agent using these instructions."
      actions={
        running ? (
          <Button
            color="error"
            variant="outlined"
            disabled={controls.busy}
            onClick={() => void stopWithConfirm()}
          >
            Stop
          </Button>
        ) : (
          // A disabled button emits no pointer events, so the tooltip needs an enabled span to hover over.
          <Tooltip title={goalsEmpty ? "Write the pilot's goals before starting it." : ""}>
            <Box component="span" sx={{ display: "inline-flex" }}>
              <Button
                variant="contained"
                disabled={controls.busy || health !== "reachable" || goalsEmpty}
                onClick={() => void controls.start()}
              >
                Start
              </Button>
            </Box>
          </Tooltip>
        )
      }
    >
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 7 }}>
          <Stack spacing={2}>
            <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
              <Chip
                color={running ? "success" : "default"}
                label={running ? "Running" : "Stopped"}
                size="small"
              />
              <Chip
                variant="outlined"
                color={pilot?.paired ? "primary" : "default"}
                label={pilot?.paired ? "Agent connected" : "Agent not connected"}
                size="small"
              />
              {pilot?.conducting && <Chip color="info" label="Working" size="small" />}
              {/* First-cycle feedback: right after Start there is no history yet - say so instead of looking idle. */}
              {running && state.cycleCount === 0 && !pilot?.conducting && (
                <Chip
                  color="info"
                  variant="outlined"
                  label={PILOT_STARTING_UP_LABEL}
                  size="small"
                />
              )}
              {typeof pilot?.consecutiveTimeouts === "number" && pilot.consecutiveTimeouts > 0 && (
                <Chip
                  color="warning"
                  variant="outlined"
                  label={`${pilot.consecutiveTimeouts} timeout${pilot.consecutiveTimeouts > 1 ? "s" : ""}`}
                  size="small"
                />
              )}
            </Stack>

            {/* The stopped + offline case is the setup checklist's job; only warn when cycles should be running. */}
            {running && isHostOffline(health) && (
              <Alert severity="warning">{PILOT_HOST_OFFLINE_MESSAGE}</Alert>
            )}

            <Stack direction="row" spacing={3} sx={{ flexWrap: "wrap", gap: 2 }}>
              <Box>
                <Typography variant="overlineMuted">Provider</Typography>
                <Typography variant="body2">{providerDisplayName(controls.provider)}</Typography>
              </Box>
              <Box>
                <Typography variant="overlineMuted">Cycles run</Typography>
                <Typography variant="body2">{state.cycleCount}</Typography>
              </Box>
              <Box>
                <Typography variant="overlineMuted">Last cycle</Typography>
                <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                  {state.lastCycleAt ? (
                    <RelativeTime value={state.lastCycleAt} variant="body2" />
                  ) : (
                    <Typography variant="body2">-</Typography>
                  )}
                  {pilot?.lastCycleStatus && (
                    <ColorChip
                      value={pilot.lastCycleStatus}
                      colors={CYCLE_STATUS_COLOR}
                      variant="filled"
                      size="small"
                    />
                  )}
                </Stack>
              </Box>
              {/* Hidden mid-cycle: the "Working" chip already covers that state. */}
              {running && nextWakeAt && !pilot?.conducting && (
                <Box>
                  <Typography variant="overlineMuted">Next wake</Typography>
                  <Typography variant="body2">
                    {nextWakeAt.getTime() <= Date.now()
                      ? "due now"
                      : `in ${formatTimeUntil(nextWakeAt)}`}
                  </Typography>
                </Box>
              )}
            </Stack>
          </Stack>
        </Grid>

        <Grid size={{ xs: 12, md: 5 }}>
          <Stack spacing={2}>
            <Stack spacing={0.5}>
              <Typography variant="overlineMuted">Today</Typography>
              {dailyApplyCap > 0 ? (
                <>
                  <Stack
                    direction="row"
                    sx={{ justifyContent: "space-between", alignItems: "baseline" }}
                  >
                    <Typography variant="body2Muted">Applied</Typography>
                    <Typography variant="body2" color={capReached ? "error.main" : "text.primary"}>
                      {appliedToday} / {dailyApplyCap}
                    </Typography>
                  </Stack>
                  <LinearProgress
                    variant="determinate"
                    value={progress}
                    color={capReached ? "error" : "primary"}
                  />
                </>
              ) : (
                <Typography variant="body2Muted">
                  Daily apply cap is 0 - the pilot won't apply until you raise it.
                </Typography>
              )}
            </Stack>
            <Grid container spacing={1.5}>
              <Grid size={4}>
                <StatCard label="Min score" value={minScore} />
              </Grid>
              <Grid size={4}>
                <StatCard label="Daily cap" value={dailyApplyCap} />
              </Grid>
              <Grid size={4}>
                {/* Cap only: no endpoint exposes networking-sent-today, so a meter would lie. */}
                <StatCard
                  label="Networking cap"
                  value={networkingEnabled ? dailyNetworkingCap : "Off"}
                  hint={networkingEnabled ? "per day" : "disabled"}
                />
              </Grid>
            </Grid>
          </Stack>
        </Grid>
      </Grid>
    </SectionCard>
  );
}
