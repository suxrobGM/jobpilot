import type { ReactElement } from "react";
import { Box, Grid, Stack, Typography } from "@mui/material";
import { InboxPanel, ResumePanel, UpworkPanel, WorkspacePanel } from "../mock-panels";
import { Section } from "../section";
import { SectionEyebrow } from "../section-eyebrow";

interface TourRow {
  eyebrow: string;
  title: string;
  body: string;
  panel: ReactElement;
  /** Quiet radial wash behind the panel, tone-matched to its content. */
  glow: string;
}

const ROWS: TourRow[] = [
  {
    eyebrow: "WORKSPACE",
    title: "Every application, one funnel.",
    body: "Six statuses from applied to offer, in a funnel you never fill in by hand. The agent reports each application as it lands, and analytics sit on top.",
    panel: <WorkspacePanel />,
    glow: "rgba(255,106,61,0.07)",
  },
  {
    eyebrow: "INBOX",
    title: "Replies land sorted.",
    body: "JobPilot reads recruiter replies from your Gmail, classifies them, and matches each to an application. You approve the status move - nothing changes without you.",
    panel: <InboxPanel />,
    glow: "rgba(59,130,246,0.07)",
  },
  {
    eyebrow: "RESUME STUDIO",
    title: "One resume, tailored per job.",
    body: "Keep a base resume; the agent creates a tailored variant per application, rendered to PDF live. You always know which version went where.",
    panel: <ResumePanel />,
    glow: "rgba(22,217,138,0.06)",
  },
  {
    eyebrow: "UPWORK",
    title: "Freelance without the lottery.",
    body: "Client-quality filters drop low hire rates and empty spend histories before ranking what's left. Proposals and profile improvements are drafted for your approval.",
    panel: <UpworkPanel />,
    glow: "rgba(255,106,61,0.07)",
  },
];

export function ProductTour(): ReactElement {
  return (
    <Section>
      <Stack spacing={{ xs: 8, md: 12 }}>
        {ROWS.map((row, i) => (
          <Grid
            key={row.eyebrow}
            container
            spacing={{ xs: 3, md: 8 }}
            direction={i % 2 ? "row-reverse" : "row"}
            sx={{ alignItems: "center" }}
          >
            <Grid size={{ xs: 12, md: 5 }}>
              <Stack spacing={1.5}>
                <SectionEyebrow color="accent.primary">{row.eyebrow}</SectionEyebrow>
                <Typography variant="h2">{row.title}</Typography>
                <Typography variant="body1Muted" sx={{ fontSize: "0.9375rem", maxWidth: 440 }}>
                  {row.body}
                </Typography>
              </Stack>
            </Grid>
            <Grid size={{ xs: 12, md: 7 }} sx={{ position: "relative" }}>
              <Box
                aria-hidden
                sx={{
                  position: "absolute",
                  // Zero horizontal bleed on mobile - it widens the page and causes sideways scroll.
                  inset: { xs: "-48px 0", md: -48 },
                  background: `radial-gradient(ellipse 60% 60% at 50% 50%, ${row.glow}, transparent 70%)`,
                  pointerEvents: "none",
                }}
              />
              <Box sx={{ position: "relative" }}>{row.panel}</Box>
            </Grid>
          </Grid>
        ))}
      </Stack>
    </Section>
  );
}
