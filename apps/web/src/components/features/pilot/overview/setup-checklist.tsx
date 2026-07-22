"use client";

import type { ReactNode } from "react";
import { CheckCircle, RadioButtonUnchecked } from "@mui/icons-material";
import { Box, Button, Stack, Typography } from "@mui/material";
import { LinkButton } from "@/components/ui/buttons";
import { SectionCard } from "@/components/ui/layout";
import { useAgentAvailable, useAgentDock } from "@/providers/agent-provider";
import { usePilotStatus } from "./pilot-status-context";

interface ChecklistStep {
  id: string;
  label: string;
  description: string;
  done: boolean;
  action: ReactNode;
}

/** Onboarding card; renders nothing once the pilot is fully set up. */
export function PilotSetupChecklist(): ReactNode {
  const { state, toggle, health } = usePilotStatus();
  const dock = useAgentDock();
  const agentAvailable = useAgentAvailable();

  const hostReady = health === "reachable";
  const enabled = state.enabled;
  const goalsDone = state.instructionsGoals.trim() !== "";

  // "checking" counts as provisionally done so a set-up pilot doesn't flash the checklist on load.
  if ((hostReady || health === "checking") && enabled) {
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
      id: "goals",
      label: "Write your goals",
      description: "Goals steer the pilot - it creates and re-runs its own searches from them.",
      done: goalsDone,
      action: (
        <LinkButton size="small" variant="outlined" href="/pilot/instructions">
          Write goals
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
          disabled={toggle.busy || !hostReady || !goalsDone}
          onClick={() => void toggle.enable()}
        >
          Enable
        </Button>
      ),
    },
  ];

  return (
    <SectionCard
      title="Set up the pilot"
      description="Install the agent and enable the pilot - it handles the rest."
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
              <Typography variant="body1Strong">{step.label}</Typography>
              <Typography variant="captionMuted">{step.description}</Typography>
            </Box>
            {!step.done && step.action}
          </Stack>
        ))}
      </Stack>
    </SectionCard>
  );
}
