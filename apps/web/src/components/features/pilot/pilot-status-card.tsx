"use client";

import type { ReactElement } from "react";
import type { PilotState } from "@jobpilot/contracts/pilot";
import { Alert, Box, Button, Chip, Stack, Typography } from "@mui/material";
import { ColorChip } from "@/components/ui/display";
import { SectionCard } from "@/components/ui/layout";
import type { PilotCycleStatus } from "@/lib/terminal";
import { formatRelativeTime } from "@/utils/format";
import { useTerminalHealth } from "../agent-dock/use-terminal-health";
import { usePilotToggle } from "./use-pilot-toggle";

interface PilotStatusCardProps {
  state: PilotState;
}

const CYCLE_STATUS_COLOR: Record<PilotCycleStatus, "success" | "warning" | "error" | "default"> = {
  ok: "success",
  empty: "default",
  error: "error",
};

export function PilotStatusCard(props: PilotStatusCardProps): ReactElement {
  const { state } = props;
  const toggle = usePilotToggle();
  const { health, status } = useTerminalHealth(toggle.busy);

  const hostOffline = health === "offline" || health === "uninstalled" || health === "checking";
  const pilot = status?.pilot ?? null;
  const enabled = state.enabled;

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
            onClick={() => toggle.disable()}
          >
            Disable
          </Button>
        ) : (
          <Button
            variant="contained"
            disabled={toggle.busy || hostOffline}
            onClick={() => toggle.enable()}
          >
            Enable
          </Button>
        )
      }
    >
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
          {typeof pilot?.consecutiveTimeouts === "number" && pilot.consecutiveTimeouts > 0 && (
            <Chip
              color="warning"
              variant="outlined"
              label={`${pilot.consecutiveTimeouts} timeout${pilot.consecutiveTimeouts > 1 ? "s" : ""}`}
              size="small"
            />
          )}
        </Stack>

        {hostOffline && !enabled && (
          <Alert severity="warning">
            Terminal host offline - install or start the JobPilot agent from the dock first.
          </Alert>
        )}

        <Stack direction="row" spacing={3} sx={{ flexWrap: "wrap", gap: 2 }}>
          <Box>
            <Typography variant="overlineMuted">Provider</Typography>
            <Typography variant="body2">
              {toggle.provider === "codex" ? "Codex" : "Claude Code"}
            </Typography>
          </Box>
          <Box>
            <Typography variant="overlineMuted">Cycles run</Typography>
            <Typography variant="body2">{state.cycleCount}</Typography>
          </Box>
          <Box>
            <Typography variant="overlineMuted">Last cycle</Typography>
            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
              <Typography variant="body2">
                {state.lastCycleAt ? `${formatRelativeTime(state.lastCycleAt)} ago` : "-"}
              </Typography>
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
    </SectionCard>
  );
}
