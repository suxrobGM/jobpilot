"use client";

import type { ReactElement } from "react";
import type { PilotState } from "@jobpilot/contracts/pilot";
import { Alert, Box, Button, Chip, Grid, LinearProgress, Stack, Typography } from "@mui/material";
import { ColorChip, RelativeTime, StatCard } from "@/components/ui/display";
import { SectionCard } from "@/components/ui/layout";
import { type PilotCycleStatus, providerDisplayName, type SessionStatus } from "@/lib/terminal";
import { useConfirm } from "@/providers/confirm-provider";
import type { TerminalHealth } from "../../agent-dock/use-terminal-health";
import { isHostOffline, PILOT_HOST_OFFLINE_MESSAGE, PILOT_STARTING_UP_LABEL } from "../host-status";
import type { PilotToggle } from "../use-pilot-toggle";

interface StatusHeroProps {
  state: PilotState;
  toggle: PilotToggle;
  health: TerminalHealth;
  hostStatus: SessionStatus | null;
}

const CYCLE_STATUS_COLOR: Record<PilotCycleStatus, "success" | "warning" | "error" | "default"> = {
  ok: "success",
  empty: "default",
  error: "error",
};

/** State + controls on the left, today's budget on the right; the one card that answers "is it working?". */
export function StatusHero(props: StatusHeroProps): ReactElement {
  const { state, toggle, health, hostStatus } = props;
  const confirm = useConfirm();

  const pilot = hostStatus?.pilot ?? null;
  const enabled = state.enabled;
  const { dailyApplyCap, dailyNetworkingCap, minScore, networkingEnabled } =
    state.instructionsConfig;
  const { appliedToday, capReached } = state;
  const progress = dailyApplyCap > 0 ? Math.min(100, (appliedToday / dailyApplyCap) * 100) : 0;

  const disableWithConfirm = async (): Promise<void> => {
    const ok = await confirm({
      title: "Disable the pilot?",
      description:
        "The pilot stops running cycles: no applying, networking, or posting until you enable it again.",
      confirmLabel: "Disable",
      destructive: true,
    });
    if (ok) {
      await toggle.disable();
    }
  };

  return (
    <SectionCard
      title="Pilot"
      description="Autonomous mode runs cycles on your local agent using these instructions."
      actions={
        enabled ? (
          <Button
            color="error"
            variant="outlined"
            disabled={toggle.busy}
            onClick={() => void disableWithConfirm()}
          >
            Disable
          </Button>
        ) : (
          <Button
            variant="contained"
            disabled={toggle.busy || health !== "reachable"}
            onClick={() => void toggle.enable()}
          >
            Enable
          </Button>
        )
      }
    >
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 7 }}>
          <Stack spacing={2}>
            <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
              <Chip
                color={enabled ? "success" : "default"}
                label={enabled ? "Enabled" : "Disabled"}
                size="small"
              />
              <Chip
                variant="outlined"
                color={pilot?.paired ? "primary" : "default"}
                label={pilot?.paired ? "Agent connected" : "Agent not connected"}
                size="small"
              />
              {pilot?.conducting && <Chip color="info" label="Working" size="small" />}
              {/* First-cycle feedback: right after Enable there is no history yet - say so instead of looking idle. */}
              {enabled && state.cycleCount === 0 && !pilot?.conducting && (
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

            {/* The disabled + offline case is the setup checklist's job; only warn when cycles should be running. */}
            {enabled && isHostOffline(health) && (
              <Alert severity="warning">{PILOT_HOST_OFFLINE_MESSAGE}</Alert>
            )}

            <Stack direction="row" spacing={3} sx={{ flexWrap: "wrap", gap: 2 }}>
              <Box>
                <Typography variant="overlineMuted">Provider</Typography>
                <Typography variant="body2">{providerDisplayName(toggle.provider)}</Typography>
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
