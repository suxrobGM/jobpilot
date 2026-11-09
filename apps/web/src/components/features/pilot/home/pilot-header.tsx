"use client";

import type { ReactElement } from "react";
import { FormControlLabel, Switch, Typography } from "@mui/material";
import { api } from "@/api/client";
import { pilotQueries } from "@/api/queries";
import { useApiMutation } from "@/api/use-api-mutation";
import { PageHeader } from "@/components/ui/layout";
import { useConfirm } from "@/providers/confirm-provider";
import { usePilotState } from "../state/use-pilot-state";

/** Today's progress against the cap and the autopilot switch, in the top bar. */
export function PilotHeader(): ReactElement {
  const state = usePilotState();
  const confirm = useConfirm();
  // Autopilot gates only the pilot's own work; requests and chat run either way.
  const autopilot = useApiMutation((enabled: boolean) => api.pilot.autopilot.put({ enabled }), {
    invalidate: [pilotQueries.state().queryKey],
    successMessage: (_state, enabled) => (enabled ? "Autopilot on." : "Autopilot paused."),
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
        <FormControlLabel
          label={<Typography variant="body2Muted">Autopilot</Typography>}
          disabled={autopilot.isPending}
          sx={{ mr: 0 }}
          control={
            <Switch
              size="small"
              checked={state.autopilot}
              onChange={(_, checked) => void toggle(checked)}
            />
          }
        />
      }
    />
  );
}
