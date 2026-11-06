"use client";

import { type ReactElement, type ReactNode, useState } from "react";
import type { PilotState } from "@jobpilot/contracts/pilot";
import {
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import type { Route } from "next";
import { credentialQueries, emailQueries, resumeQueries, userQueries } from "@/api/queries";
import { LinkButton } from "@/components/ui/buttons";
import { ChecklistRow } from "@/components/ui/display";
import { useTerminalHealth } from "@/hooks/use-terminal-health";
import { hasGoals } from "../pilot-status";

interface Step {
  key: string;
  /** For the one-line summary. */
  short: string;
  label: string;
  done: boolean;
  /** None for the agent and autopilot: the status line owns those. */
  action?: ReactNode;
}

function linkAction(href: Route, label: string): ReactElement {
  return (
    <LinkButton href={href} size="small" variant="outlined">
      {label}
    </LinkButton>
  );
}

interface GetStartedProps {
  state: PilotState;
}

/** One line above the thread until everything the pilot needs is in place. */
export function GetStarted(props: GetStartedProps): ReactNode {
  const { state } = props;
  const [open, setOpen] = useState(false);
  const { status } = useTerminalHealth();
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
      short: "Upload a resume",
      label: "Upload a resume. The pilot scores jobs against it and applies with it.",
      done: resumes.length > 0,
      action: linkAction("/documents/resumes", "Upload"),
    },
    {
      key: "profile",
      short: "Add your address",
      label: "Add your address and work authorization. Application forms ask for both.",
      done: Boolean(profile.user?.street && profile.user.city),
      action: linkAction("/settings/profile", "Fill in"),
    },
    {
      key: "goals",
      short: "Write your goals",
      label: "Tell the pilot what jobs you want. It builds its searches from your goals.",
      done: hasGoals(state),
      action: linkAction("/pilot/goals", "Write goals"),
    },
    {
      key: "email",
      short: needsReauth ? "Reconnect your mailbox" : "Connect your mailbox",
      label: needsReauth
        ? "Reconnect your mailbox. Google rejected its access grant, so mail sync has stopped."
        : "Connect your mailbox so the pilot can read recruiter replies and verification codes.",
      done: mailbox.connected && !needsReauth,
      action: linkAction("/settings/email", needsReauth ? "Reconnect" : "Connect"),
    },
    {
      key: "credentials",
      short: "Save board logins",
      label: "Save your job-board logins so the pilot can sign in before it applies.",
      done: credentials.length > 0,
      action: linkAction("/settings/credentials", "Add"),
    },
    {
      key: "agent",
      short: "Start the agent",
      label: "Run the JobPilot agent on your computer. The pilot works through it.",
      done: paired,
    },
    {
      key: "autopilot",
      short: "Turn on autopilot",
      label: "Turn on autopilot. The pilot finds, scores and applies to jobs on its own.",
      done: state.autopilot,
    },
  ];

  const left = steps.filter((step) => !step.done);
  if (left.length === 0) {
    return null;
  }
  return (
    <Paper variant="outlined" sx={{ px: 2, py: 1 }}>
      <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
        <Typography variant="body2" sx={{ flex: 1, minWidth: 0 }}>
          <Typography component="span" variant="body2Strong">
            {`${left.length} ${left.length === 1 ? "step" : "steps"} left: `}
          </Typography>
          {left.map((step) => step.short).join(" · ")}
        </Typography>
        <Button size="small" variant="outlined" onClick={() => setOpen(true)}>
          Finish
        </Button>
      </Stack>
      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{`Get started · ${steps.length - left.length}/${steps.length}`}</DialogTitle>
        <DialogContent>
          <Stack spacing={1}>
            {steps.map((step) => (
              <ChecklistRow
                key={step.key}
                done={step.done}
                label={step.label}
                action={step.action}
              />
            ))}
          </Stack>
        </DialogContent>
      </Dialog>
    </Paper>
  );
}
