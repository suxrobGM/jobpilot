import type { ReactElement } from "react";
import { alpha, Box, Container, Grid, Link, Stack, Typography } from "@mui/material";
import { LinkButton } from "@/components/ui/buttons";
import { accent, fontFamilies } from "@/theme";
import { SectionEyebrow } from "../section-eyebrow";

// A server component, so sx must stay a plain object - a `(theme) => …` callback
// is a function, and functions cannot cross the RSC boundary.
const emberWash = `radial-gradient(ellipse 70% 70% at 50% 0%, ${alpha(accent.primary, 0.08)}, transparent 60%)`;

interface Step {
  title: string;
  body: string;
}

const STEPS: Step[] = [
  {
    title: "Write one mandate",
    body: "Goals, daily caps, active hours, standing searches, outreach autonomy, promotion venues. Write your goals once - the Pilot runs the search from there.",
  },
  {
    title: "Close the lid",
    body: "The agent runs perpetual sense-decide-act cycles on your machine: it discovers and scores roles, finds warm intros before cold applies, sends and chases outreach, and reviews recruiter replies - overnight, with the browser closed.",
  },
  {
    title: "Answer from your phone",
    body: "When it needs you - a salary answer, a login code, an InMail to approve - it escalates as a one-tap card by web push. Answer from your phone and the parked work resumes.",
  },
  {
    title: "Wake to a journal",
    body: "Every action lands in a live feed, rolled into a morning digest: applications submitted, replies reviewed, questions waiting. It never sends InMail or posts publicly without your approval, and hard caps are enforced server-side.",
  },
];

export function Pilot(): ReactElement {
  return (
    <Box
      sx={{
        position: "relative",
        overflow: "hidden",
        borderBlock: 1,
        borderColor: "line.divider",
        backgroundColor: "surfaces.card",
      }}
    >
      <Box
        aria-hidden
        sx={{ position: "absolute", inset: 0, background: emberWash, pointerEvents: "none" }}
      />
      <Container maxWidth="lg" sx={{ position: "relative", paddingBlock: { xs: 7, md: 10 } }}>
        <Stack spacing={2} sx={{ mb: 5, maxWidth: 620 }}>
          <SectionEyebrow color="accent.primary">THE PILOT · AUTONOMOUS MODE</SectionEyebrow>
          <Typography variant="h2">Write your goals once. Close the lid.</Typography>
          <Typography variant="body1Muted" sx={{ fontSize: "0.9375rem" }}>
            The Pilot is JobPilot's flagship autonomous mode. You write a mandate; the local agent
            runs your entire search on its own - review-gated, capped, and journaling every move -
            so you wake to what it did instead of driving each step by hand.
          </Typography>
        </Stack>
        <Grid container spacing={4}>
          {STEPS.map((step, i) => (
            <Grid key={step.title} size={{ xs: 12, sm: 6, md: 3 }}>
              <Stack spacing={1.5} sx={{ alignItems: "flex-start" }}>
                <Typography
                  sx={{
                    fontFamily: fontFamilies.mono,
                    fontSize: "1.5rem",
                    fontWeight: 700,
                    color: "accent.primary",
                  }}
                >
                  {String(i + 1).padStart(2, "0")}
                </Typography>
                <Typography variant="h3" sx={{ fontSize: "1.2rem" }}>
                  {step.title}
                </Typography>
                <Typography variant="body2Muted">{step.body}</Typography>
              </Stack>
            </Grid>
          ))}
        </Grid>
        <Stack
          direction="row"
          spacing={2}
          sx={{ mt: 5, flexWrap: "wrap", gap: 2, alignItems: "center" }}
        >
          <LinkButton href="/install" variant="contained" size="large">
            Put it on autopilot
          </LinkButton>
          <Typography variant="body2Muted">
            <Link href="/docs/pilot">Read the Pilot guide</Link>
          </Typography>
        </Stack>
      </Container>
    </Box>
  );
}
