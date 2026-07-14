import type { ReactElement } from "react";
import { Box, Grid, Stack, Typography } from "@mui/material";
import { fontFamilies, line, radii } from "@/theme";
import { Section } from "./section";

const STEPS = [
  {
    title: "Install the plugin",
    body: "Add JobPilot to the Claude Code or Codex subscription you already have - no API keys.",
    snippet: "/plugin install jobpilot",
  },
  {
    title: "Run setup & sign up",
    body: "The setup skill installs and starts your local agent. Sign up and onboarding builds your profile from your resume - what the agent scores and applies with.",
    snippet: "/jobpilot:setup  ·  $setup",
  },
  {
    title: "Run a campaign",
    body: "Launch the agent from the dashboard dock. Start with a search, graduate to auto-apply.",
    snippet: "/jobpilot:auto-apply  ·  $auto-apply",
  },
];

export function HowItWorks(): ReactElement {
  return (
    <Box
      id="how-it-works"
      sx={{ borderBlock: 1, borderColor: "line.divider", backgroundColor: "surfaces.card" }}
    >
      <Section>
        <Typography variant="h2" sx={{ mb: 4 }}>
          From zero to applied in three steps.
        </Typography>
        <Grid container spacing={4}>
          {STEPS.map((step, i) => (
            <Grid key={step.title} size={{ xs: 12, md: 4 }}>
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
                <Box
                  component="code"
                  sx={{
                    fontFamily: fontFamilies.mono,
                    fontSize: "0.75rem",
                    color: "text.secondary",
                    backgroundColor: "surfaces.elevated",
                    border: `1px solid ${line.divider}`,
                    borderRadius: `${radii.sm}px`,
                    paddingInline: 1,
                    paddingBlock: 0.5,
                  }}
                >
                  {step.snippet}
                </Box>
              </Stack>
            </Grid>
          ))}
        </Grid>
      </Section>
    </Box>
  );
}
