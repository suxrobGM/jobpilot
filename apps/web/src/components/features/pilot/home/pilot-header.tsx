"use client";

import type { ReactElement } from "react";
import { useState } from "react";
import { Button, FormControlLabel, Menu, MenuItem, Stack, Switch, Typography } from "@mui/material";
import { api } from "@/api/client";
import { pilotQueries } from "@/api/queries";
import { useApiMutation } from "@/api/use-api-mutation";
import { PageHeader } from "@/components/ui/layout";
import { useConfirm } from "@/providers/confirm-provider";
import { usePilotState } from "../state/use-pilot-state";

/** Hours the pause menu offers. */
const PAUSE_HOURS = [1, 4, 8] as const;

/** Today's progress against the cap and the autopilot switch, in the top bar. */
export function PilotHeader(): ReactElement {
  const state = usePilotState();
  const confirm = useConfirm();
  const [pauseAnchor, setPauseAnchor] = useState<HTMLElement | null>(null);
  const pausedUntil = state.autopilotPausedUntil;
  const paused = state.autopilot && pausedUntil !== null && pausedUntil > new Date();
  // Autopilot gates only the pilot's own work; requests and chat run either way.
  const autopilot = useApiMutation((enabled: boolean) => api.pilot.autopilot.put({ enabled }), {
    invalidate: [pilotQueries.state().queryKey],
    successMessage: (_state, enabled) => (enabled ? "Autopilot on." : "Autopilot paused."),
  });

  const pause = useApiMutation((hours: number) => api.pilot.autopilot.pause.post({ hours }), {
    invalidate: [pilotQueries.state().queryKey],
    successMessage: (_state, hours) =>
      `Autopilot paused for ${hours} ${hours === 1 ? "hour" : "hours"}.`,
  });
  const resume = useApiMutation(() => api.pilot.autopilot.resume.post(), {
    invalidate: [pilotQueries.state().queryKey],
    successMessage: "Autopilot resumed.",
  });

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
    <PageHeader
      title="Pilot"
      subtitle={`${state.appliedToday}/${state.config.dailyApplyCap} applied today`}
      actions={
        <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}>
          {state.autopilot && paused && pausedUntil && (
            <Typography variant="body2Muted">
              Paused until {pausedUntil.toLocaleString()}
            </Typography>
          )}
          {state.autopilot && paused && (
            <Button
              size="small"
              variant="contained"
              disabled={resume.isPending}
              onClick={() => resume.mutate(undefined)}
            >
              Resume
            </Button>
          )}
          {state.autopilot && !paused && (
            <Button
              size="small"
              variant="outlined"
              disabled={pause.isPending}
              aria-haspopup="menu"
              onClick={(event) => setPauseAnchor(event.currentTarget)}
            >
              Pause
            </Button>
          )}
          <Menu
            anchorEl={pauseAnchor}
            open={pauseAnchor !== null}
            onClose={() => setPauseAnchor(null)}
          >
            {PAUSE_HOURS.map((hours) => (
              <MenuItem
                key={hours}
                onClick={() => {
                  setPauseAnchor(null);
                  pause.mutate(hours);
                }}
              >
                Pause for {hours} {hours === 1 ? "hour" : "hours"}
              </MenuItem>
            ))}
          </Menu>
          <FormControlLabel
            label={<Typography variant="body2Muted">Autopilot</Typography>}
            disabled={autopilot.isPending}
            control={
              <Switch
                size="small"
                checked={state.autopilot}
                onChange={(_, checked) => void toggle(checked)}
              />
            }
          />
        </Stack>
      }
    />
  );
}
