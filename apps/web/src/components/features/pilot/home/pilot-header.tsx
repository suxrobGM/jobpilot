"use client";

import type { ReactElement } from "react";
import type { PilotState } from "@jobpilot/contracts/pilot";
import { Box, FormControlLabel, Stack, Switch, Tooltip, Typography } from "@mui/material";
import { JobPilotMark } from "@/components/brand/jobpilot-mark";
import { PulseDot } from "@/components/ui/feedback";
import { useConfirm } from "@/providers/confirm-provider";
import { hasGoals, PILOT_MODE_LOOK } from "../pilot-status";
import { useAutopilot } from "../use-autopilot";
import { usePilotStatus } from "../use-pilot-status";

interface PilotHeaderProps {
  state: PilotState;
}

/** Who you're talking to, whether it's up, how far into today's cap, and the autopilot switch. */
export function PilotHeader(props: PilotHeaderProps): ReactElement {
  const { state } = props;
  const confirm = useConfirm();
  const autopilot = useAutopilot();
  const { mode } = usePilotStatus(state);
  const look = PILOT_MODE_LOOK[mode];
  const goalsMissing = !hasGoals(state);

  const toggle = async (enabled: boolean): Promise<void> => {
    if (enabled) {
      autopilot.mutate(true);
      return;
    }
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
    <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
      <JobPilotMark size={32} />
      <Stack sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body1Strong">Pilot</Typography>
        <Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
          <PulseDot tone={look.tone} pulsing={look.pulsing} size="xs" />
          <Typography variant="captionMuted" noWrap>
            {`${look.label} · ${state.appliedToday}/${state.config.dailyApplyCap} today`}
          </Typography>
        </Stack>
      </Stack>
      <Tooltip title={goalsMissing && !state.autopilot ? "Write your goals first." : ""}>
        {/* A disabled switch emits no pointer events, so the tooltip hovers this box. */}
        <Box component="span">
          <FormControlLabel
            label={<Typography variant="body2Muted">Autopilot</Typography>}
            disabled={autopilot.isPending || (goalsMissing && !state.autopilot)}
            control={
              <Switch
                size="small"
                checked={state.autopilot}
                onChange={(_, checked) => void toggle(checked)}
              />
            }
          />
        </Box>
      </Tooltip>
    </Stack>
  );
}
