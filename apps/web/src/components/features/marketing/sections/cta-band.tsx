import type { ReactElement } from "react";
import { Card, CardContent, Stack, Typography } from "@mui/material";
import { LinkButton } from "@/components/ui/buttons";
import { SITE_HOST } from "@/lib/constants";
import { radii } from "@/theme";
import { Glow } from "../glow";
import { type NumberedStep, NumberedSteps } from "../numbered-steps";
import { Section } from "../section";

const SETUP: NumberedStep[] = [
  {
    title: "Install the plugin",
    body: "Add JobPilot to Claude Code or Codex and run setup. It installs the agent on your computer and starts it.",
    snippet: "/jobpilot:setup",
  },
  {
    title: "Create your account",
    body: "Sign up and upload your resume. The agent reads it and fills in your profile.",
    snippet: `${SITE_HOST}/register`,
  },
  {
    title: "Turn on the Pilot",
    body: "Write your goals and rules, then turn on autopilot. Leave it off at first and ask for a search if you'd like to check the matches.",
    snippet: "Pilot → Turn on autopilot",
  },
];

export function CtaBand(): ReactElement {
  return (
    <Section>
      <Card
        variant="accent"
        sx={{ position: "relative", overflow: "hidden", borderRadius: radii.lg }}
      >
        <Glow placement="corner" />
        <CardContent sx={{ position: "relative", padding: { xs: 3, md: 6 } }}>
          <Stack spacing={{ xs: 4, md: 5 }}>
            <Stack spacing={2} sx={{ maxWidth: 620 }}>
              <Typography variant="displayMd">Start your first search in ten minutes.</Typography>
              <Typography variant="lead">
                Three steps, and you can stop the agent at any time.
              </Typography>
            </Stack>
            <NumberedSteps steps={SETUP} columns={3} />
            <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1.5 }}>
              <LinkButton href="/install" variant="contained" size="large">
                Get started
              </LinkButton>
              <LinkButton href="/docs" variant="outlined" size="large">
                Read the docs
              </LinkButton>
            </Stack>
          </Stack>
        </CardContent>
      </Card>
    </Section>
  );
}
