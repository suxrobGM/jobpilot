import type { ReactElement } from "react";
import { Grid, Link, Stack } from "@mui/material";
import { LinkButton } from "@/components/ui/buttons";
import { type NumberedStep, NumberedSteps } from "../numbered-steps";
import { Section } from "../section";
import { SectionHeading } from "../section-heading";

const STEPS: NumberedStep[] = [
  {
    title: "Say what you want",
    body: "Describe the jobs you want in a few sentences, with a daily limit and any deal-breakers. To change course later, tell it.",
  },
  {
    title: "It gets to work",
    body: "With autopilot on, it looks for jobs, scores them against your resume, applies to the good ones, and finds people worth contacting. With nothing to do, the AI stays off and uses none of your quota.",
  },
  {
    title: "Answer from your phone",
    body: "A salary question, a login code, or a message to approve comes to you as a notification. Answer it and the job carries on.",
  },
  {
    title: "See what it did",
    body: "It reports each task as it finishes and shows the one in progress step by step. Each morning you get a summary of applications sent and replies received.",
  },
];

export function Pilot(): ReactElement {
  return (
    <Section id="how-it-works" band glow="top">
      <Grid container spacing={{ xs: 5, md: 8 }}>
        <Grid size={{ xs: 12, md: 4 }}>
          <Stack spacing={3} sx={{ alignItems: "flex-start" }}>
            <SectionHeading
              eyebrow="How the Pilot works"
              title="Set it up once. It keeps your search going."
              lead="You say what you want. It searches, applies, and follows up, and asks when it needs a decision."
            />
            <Stack direction="row" sx={{ flexWrap: "wrap", gap: 2, alignItems: "center" }}>
              <LinkButton href="/install" variant="contained">
                Get started
              </LinkButton>
              <Link href="/docs/pilot" variant="body1">
                Read the Pilot guide
              </Link>
            </Stack>
          </Stack>
        </Grid>
        <Grid size={{ xs: 12, md: 8 }}>
          <NumberedSteps steps={STEPS} columns={2} />
        </Grid>
      </Grid>
    </Section>
  );
}
