"use client";

import type { ReactNode } from "react";
import type { PilotState } from "@jobpilot/contracts/pilot";
import { CheckCircle, RadioButtonUnchecked } from "@mui/icons-material";
import { Box, Button, Stack, Typography } from "@mui/material";
import { useApiQuery } from "@/api/hooks";
import { emailQueries } from "@/api/queries";
import { LinkButton } from "@/components/ui/buttons";
import { SectionCard } from "@/components/ui/layout";
import { useAgentAvailable, useAgentDock } from "@/providers/agent-provider";
import type { TerminalHealth } from "../../agent-dock/use-terminal-health";
import { hasGoals } from "../pilot-status";

interface ChecklistStep {
  id: string;
  label: string;
  description: string;
  done: boolean;
  action: ReactNode;
}

interface PilotSetupChecklistProps {
  state: PilotState;
  health: TerminalHealth;
}

/** The pilot's prerequisites; Start lives on the status bar. Renders nothing once all are met. */
export function PilotSetupChecklist(props: PilotSetupChecklistProps): ReactNode {
  const { state, health } = props;
  const dock = useAgentDock();
  const agentAvailable = useAgentAvailable();

  const mailbox = useApiQuery(emailQueries.account()).data;

  const hostReady = health === "reachable";
  const goalsDone = hasGoals(state);
  const connected = mailbox?.connected === true;
  const needsReauth = connected && mailbox.needsReauth;
  const emailOk = connected && !needsReauth;

  // An unanswered probe counts as done here so the card doesn't flash; the step rows stay strict.
  const hostSettled = hostReady || health === "checking";
  const emailSettled = emailOk || mailbox == null;

  if (hostSettled && goalsDone && emailSettled) {
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
      id: "email",
      label: needsReauth ? "Reconnect your mailbox" : "Connect your mailbox",
      description: needsReauth
        ? "Google rejected the mailbox's access grant - mail sync, verification codes, and sending are paused."
        : "The pilot reads replies, fetches verification codes, and sends networking email through it.",
      done: emailOk,
      action: (
        <LinkButton size="small" variant="outlined" href="/settings/email">
          {needsReauth ? "Reconnect" : "Connect Gmail"}
        </LinkButton>
      ),
    },
  ];

  return (
    <SectionCard
      title="Set up the pilot"
      description="Finish these, then start the pilot - it handles the rest."
    >
      <Stack spacing={2}>
        {steps.map((step) => (
          <Stack key={step.id} direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
            {step.done ? (
              <CheckCircle fontSize="md" sx={{ color: "success.main" }} />
            ) : (
              <RadioButtonUnchecked fontSize="md" sx={{ color: "text.disabled" }} />
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
