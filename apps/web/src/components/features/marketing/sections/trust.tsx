import type { ReactElement } from "react";
import {
  ComputerRounded,
  LockRounded,
  MailRounded,
  ShieldRounded,
  type SvgIconComponent,
} from "@mui/icons-material";
import { Grid, Link, Stack, Typography } from "@mui/material";
import { GITHUB_URL } from "@/lib/constants";
import { Section } from "../section";
import { SectionHeading } from "../section-heading";

interface Fact {
  icon: SvgIconComponent;
  title: string;
  body: string;
}

const FACTS: Fact[] = [
  {
    icon: ComputerRounded,
    title: "Runs on your computer",
    body: "The agent and its browser run on your machine, on your Claude or Codex plan. You can watch everything it does and stop it at any time.",
  },
  {
    icon: ShieldRounded,
    title: "Limits it can't break",
    body: "Your daily application and message limits are enforced by the server, not by the AI, so it can't go past them.",
  },
  {
    icon: LockRounded,
    title: "Encrypted logins",
    body: "Job board passwords and captcha keys are encrypted with a key that belongs only to your account.",
  },
  {
    icon: MailRounded,
    title: "Your own Gmail app",
    body: "You connect Gmail through a Google app you create yourself, so your email never passes through a shared one.",
  },
];

export function Trust(): ReactElement {
  return (
    <Section band>
      <SectionHeading
        eyebrow="Privacy"
        title="Your computer, your accounts, your limits."
        lead={
          <>
            JobPilot is free and <Link href={GITHUB_URL}>open source</Link>. The AI runs on your
            machine; the website only stores your profile and applications.
          </>
        }
      />
      <Grid container spacing={{ xs: 4, md: 5 }} sx={{ mt: { xs: 5, md: 6 } }}>
        {FACTS.map(({ icon: Icon, title, body }) => (
          <Grid key={title} size={{ xs: 12, sm: 6, md: 3 }}>
            <Stack spacing={1.25} sx={{ alignItems: "flex-start" }}>
              <Icon color="primary" fontSize="xl" />
              <Typography variant="h4" component="h3">
                {title}
              </Typography>
              <Typography variant="body2Muted">{body}</Typography>
            </Stack>
          </Grid>
        ))}
      </Grid>
    </Section>
  );
}
