"use client";

import type { ReactNode } from "react";
import type { PilotState } from "@jobpilot/contracts/pilot";
import { Button, Stack } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { emailQueries } from "@/api/queries";
import { LinkButton } from "@/components/ui/buttons";
import { ChecklistRow } from "@/components/ui/display";
import { SectionCard } from "@/components/ui/layout";
import { useTerminalHealth } from "@/hooks/use-terminal-health";
import { useAgentAvailable, useAgentDock } from "@/providers/agent-provider";
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
}

/** The pilot's prerequisites; Start lives on the status bar. Renders nothing once all are met. */
export function PilotSetupChecklist(props: PilotSetupChecklistProps): ReactNode {
  const { state } = props;
  const { health } = useTerminalHealth();
  const dock = useAgentDock();
  const agentAvailable = useAgentAvailable();

  const mailbox = useQuery(emailQueries.account()).data;

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
          {needsReauth ? "Reconnect" : "Connect email"}
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
          <ChecklistRow
            key={step.id}
            done={step.done}
            label={step.label}
            description={step.description}
            action={step.action}
          />
        ))}
      </Stack>
    </SectionCard>
  );
}
