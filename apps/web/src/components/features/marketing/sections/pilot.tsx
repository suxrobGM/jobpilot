import type { ReactElement } from "react";
import { Grid, Link, Stack } from "@mui/material";
import { LinkButton } from "@/components/ui/buttons";
import { type NumberedStep, NumberedSteps } from "../numbered-steps";
import { Section } from "../section";
import { SectionHeading } from "../section-heading";

const STEPS: NumberedStep[] = [
  {
    title: "Say what you want",
    body: "Describe the jobs you're after in a few sentences, and set a daily limit and any deal-breakers. Change your mind later by just telling it.",
  },
  {
    title: "It gets to work",
    body: "With autopilot on, it looks for jobs, scores them against your resume, applies to the good ones, and finds people worth contacting. With nothing to do, the AI stays off and uses none of your quota.",
  },
  {
    title: "Answer from your phone",
    body: "When it needs you - a salary question, a login code, approval to send a message - you get a notification. Answer it and the job carries on.",
  },
  {
    title: "See what it did",
    body: "It reports each task as it finishes, you can watch the one in progress step by step, and each morning you get a summary of applications sent and replies received.",
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
              lead="Like an assistant: you say what you want, it searches, applies, and follows up, and it asks you when it needs a decision."
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
