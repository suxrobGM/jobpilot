"use client";

import type { ReactNode } from "react";
import type { PilotState } from "@jobpilot/contracts/pilot";
import { CheckCircle, RadioButtonUnchecked } from "@mui/icons-material";
import { Box, Button, Stack, Typography } from "@mui/material";
import { LinkButton } from "@/components/ui/buttons";
import { SectionCard } from "@/components/ui/layout";
import { useAgentAvailable, useAgentDock } from "@/providers/agent-provider";
import type { TerminalHealth } from "../../agent-dock/use-terminal-health";
import type { PilotToggle } from "../use-pilot-toggle";

interface PilotSetupChecklistProps {
  state: PilotState;
  toggle: PilotToggle;
  health: TerminalHealth;
}

interface ChecklistStep {
  id: string;
  label: string;
  description: string;
  done: boolean;
  action: ReactNode;
}

/** Onboarding card; renders nothing once the pilot is fully set up. */
export function PilotSetupChecklist(props: PilotSetupChecklistProps): ReactNode {
  const { state, toggle, health } = props;
  const dock = useAgentDock();
  const agentAvailable = useAgentAvailable();

  const hostReady = health === "reachable";
  const enabled = state.enabled;
  const instructionsDone =
    state.instructionsUpdatedAt !== null || state.instructionsGoals.trim() !== "";

  // "checking" counts as provisionally done so a set-up pilot doesn't flash the checklist on load.
  if ((hostReady || health === "checking") && enabled && instructionsDone) {
    return null;
  }

  const steps: ChecklistStep[] = [
    {
      id: "host",
      label: "Start the agent host",
      description: "The pilot runs on your machine through the JobPilot terminal.",
      done: hostReady,
      action: agentAvailable ? (
        <Button size="small" variant="outlined" onClick={dock.expand}>
          Open agent dock
        </Button>
      ) : (
        <LinkButton size="small" variant="outlined" href="/install">
          Install the agent
        </LinkButton>
      ),
    },
    {
      id: "enable",
      label: "Enable the pilot",
      description: "Turns on autonomous cycles on your own Claude or Codex subscription.",
      done: enabled,
      action: (
        <Button
          size="small"
          variant="contained"
          disabled={toggle.busy || !hostReady}
          onClick={() => void toggle.enable()}
        >
          Enable
        </Button>
      ),
    },
    {
      id: "instructions",
      label: "Write instructions",
      description: "Goals, caps, and saved searches steer every cycle.",
      done: instructionsDone,
      action: (
        <LinkButton size="small" variant="outlined" href="/pilot/instructions">
          Write instructions
        </LinkButton>
      ),
    },
  ];

  return (
    <SectionCard
      title="Set up the pilot"
      description="Three steps before the pilot can work on its own."
    >
      <Stack spacing={2}>
        {steps.map((step) => (
          <Stack key={step.id} direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
            {step.done ? (
              <CheckCircle fontSize="small" sx={{ color: "success.main" }} />
            ) : (
              <RadioButtonUnchecked fontSize="small" sx={{ color: "text.disabled" }} />
            )}
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="subtitle2">{step.label}</Typography>
              <Typography variant="captionMuted">{step.description}</Typography>
            </Box>
            {!step.done && step.action}
          </Stack>
        ))}
      </Stack>
    </SectionCard>
  );
}
