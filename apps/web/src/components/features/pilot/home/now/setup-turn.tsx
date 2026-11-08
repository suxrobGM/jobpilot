"use client";

import { type ReactElement, type ReactNode, useState } from "react";
import { Button, Dialog, DialogContent, Stack, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import type { Route } from "next";
import { credentialQueries, pilotQueries, resumeQueries, userQueries } from "@/api/queries";
import { LinkButton } from "@/components/ui/buttons";
import { ChecklistRow } from "@/components/ui/display";
import { DialogHeader } from "@/components/ui/feedback";
import { plural } from "@/utils/format";
import { usePilotState } from "../../state/use-pilot-state";
import { PilotTurn } from "../thread/pilot-turn";

interface StepLinkProps {
  href: Route;
  action: string;
}

interface Step {
  key: string;
  label: string;
  done: boolean;
  /** Null when the step happens right here, in the composer. */
  link: StepLinkProps | null;
}

function StepLink(props: StepLinkProps): ReactElement {
  const { href, action } = props;
  return (
    <LinkButton href={href} size="small" variant="outlined">
      {action}
    </LinkButton>
  );
}

/**
 * What the pilot still needs before it can apply on its own. The mailbox is a notice, and the
 * agent and autopilot belong to the live line, so neither repeats here.
 */
export function SetupTurn(): ReactNode {
  const state = usePilotState();
  const [open, setOpen] = useState(false);
  const profile = useQuery(userQueries.detail()).data;
  const resumes = useQuery(resumeQueries.list()).data;
  const credentials = useQuery(credentialQueries.list()).data;
  const searches = useQuery(pilotQueries.searches()).data;

  // Don't flash a step while the queries load.
  if (!profile || !resumes || !credentials || !searches) {
    return null;
  }

  const steps: Step[] = [
    {
      key: "resume",
      label: "Upload a resume. I score jobs against it and apply with it.",
      done: resumes.length > 0,
      link: { href: "/resumes", action: "Upload" },
    },
    {
      key: "searches",
      label:
        "Tell me what jobs you want, in a message below. Or turn on autopilot and I'll start from your resume.",
      done: searches.length > 0,
      link: null,
    },
    {
      key: "profile",
      label: "Add your address. Application forms ask for it.",
      done: Boolean(profile.user?.street && profile.user.city),
      link: { href: "/settings/profile", action: "Fill in" },
    },
    {
      key: "boards",
      label: "Check the job boards I should search.",
      done: state.config.boards.length > 0,
      link: { href: "/boards", action: "Pick boards" },
    },
    {
      key: "credentials",
      label: "Save your job-board logins so I can sign in before I apply.",
      done: credentials.length > 0,
      link: { href: "/boards", action: "Add" },
    },
  ];

  const left = steps.filter((step) => !step.done);
  const next = left[0];
  if (!next) {
    return null;
  }
  return (
    <PilotTurn>
      <Typography variant="body2">{`Before I can work on my own: ${next.label}`}</Typography>
      <Stack direction="row" spacing={1}>
        {next.link && <StepLink {...next.link} />}
        {left.length > 1 && (
          <Button size="small" color="inherit" onClick={() => setOpen(true)}>
            {plural(left.length - 1, "more step")}
          </Button>
        )}
      </Stack>
      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogHeader
          title={`Get started · ${steps.length - left.length}/${steps.length}`}
          onClose={() => setOpen(false)}
        />
        <DialogContent>
          <Stack spacing={1}>
            {steps.map((step) => (
              <ChecklistRow
                key={step.key}
                done={step.done}
                label={step.label}
                action={step.link && <StepLink {...step.link} />}
              />
            ))}
          </Stack>
        </DialogContent>
      </Dialog>
    </PilotTurn>
  );
}
