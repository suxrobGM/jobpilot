"use client";

import type { ReactElement, ReactNode } from "react";
import type { PilotState } from "@jobpilot/contracts/pilot";
import { Button, Stack } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import type { Route } from "next";
import { credentialQueries, emailQueries, resumeQueries, userQueries } from "@/api/queries";
import { LinkButton } from "@/components/ui/buttons";
import { ChecklistRow } from "@/components/ui/display";
import { SectionCard } from "@/components/ui/layout";
import { useTerminalHealth } from "@/hooks/use-terminal-health";
import { useAgentAvailable, useAgentDock } from "@/providers/agent-provider";
import { hasGoals } from "../../pilot-status";
import { usePilotControls } from "../../use-pilot-controls";

interface Step {
  key: string;
  label: string;
  done: boolean;
  action: ReactNode;
}

function linkAction(href: Route, label: string): ReactElement {
  return (
    <LinkButton href={href} size="small" variant="outlined">
      {label}
    </LinkButton>
  );
}

interface GetStartedCardProps {
  state: PilotState;
}

/** Pinned above the thread until everything the pilot needs is in place. */
export function GetStartedCard(props: GetStartedCardProps): ReactNode {
  const { state } = props;
  const { status } = useTerminalHealth();
  const dock = useAgentDock();
  const agentAvailable = useAgentAvailable();
  const controls = usePilotControls();
  const profile = useQuery(userQueries.detail()).data;
  const mailbox = useQuery(emailQueries.account()).data;
  const resumes = useQuery(resumeQueries.list()).data;
  const credentials = useQuery(credentialQueries.list()).data;

  // Don't flash an incomplete card while the queries load.
  if (!profile || !mailbox || !resumes || !credentials) {
    return null;
  }

  const needsReauth = mailbox.connected && mailbox.needsReauth;
  const paired = status?.pilot?.paired === true;
  const steps: Step[] = [
    {
      key: "resume",
      label: "Upload a resume. The pilot scores jobs against it and applies with it.",
      done: resumes.length > 0,
      action: linkAction("/documents/resumes", "Upload"),
    },
    {
      key: "profile",
      label: "Add your address and work authorization. Application forms ask for both.",
      done: Boolean(profile.user?.street && profile.user.city),
      action: linkAction("/settings/profile", "Fill in"),
    },
    {
      key: "goals",
      label: "Tell the pilot what jobs you want. It builds its searches from your goals.",
      done: hasGoals(state),
      action: linkAction("/pilot/goals", "Write goals"),
    },
    {
      key: "email",
      label: needsReauth
        ? "Reconnect your mailbox. Google rejected its access grant, so mail sync has stopped."
        : "Connect your mailbox so the pilot can read recruiter replies and verification codes.",
      done: mailbox.connected && !needsReauth,
      action: linkAction("/settings/email", needsReauth ? "Reconnect" : "Connect"),
    },
    {
      key: "credentials",
      label: "Save your job-board logins so the pilot can sign in before it applies.",
      done: credentials.length > 0,
      action: linkAction("/settings/credentials", "Add"),
    },
    {
      key: "agent",
      label: "Run the JobPilot agent on your computer. The pilot works through it.",
      done: paired || state.cycleCount > 0,
      action: agentAvailable ? (
        <Button size="small" variant="outlined" onClick={dock.expand}>
          Open agent
        </Button>
      ) : (
        linkAction("/install", "Install")
      ),
    },
    {
      key: "autopilot",
      label: "Turn the pilot on. It finds, scores and applies to jobs on its own.",
      done: state.running,
      action: (
        <Button
          size="small"
          variant="contained"
          disabled={controls.isLoading || !hasGoals(state)}
          onClick={() => void controls.start()}
        >
          Start
        </Button>
      ),
    },
  ];

  const done = steps.filter((step) => step.done).length;
  if (done === steps.length) {
    return null;
  }
  return (
    <SectionCard title={`Get started · ${done}/${steps.length}`}>
      <Stack spacing={1}>
        {steps.map((step) => (
          <ChecklistRow key={step.key} done={step.done} label={step.label} action={step.action} />
        ))}
      </Stack>
    </SectionCard>
  );
}
