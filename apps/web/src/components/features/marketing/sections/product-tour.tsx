import type { ReactElement } from "react";
import { alpha, Box, Grid, Stack, Typography } from "@mui/material";
import { accent, feedback } from "@/theme";
import { InboxPanel } from "../mock-panels/inbox-panel";
import { ResumePanel } from "../mock-panels/resume-panel";
import { UpworkPanel } from "../mock-panels/upwork-panel";
import { WorkspacePanel } from "../mock-panels/workspace-panel";
import { Section } from "../section";
import { SectionEyebrow } from "../section-eyebrow";
import { SectionGlow } from "../section-glow";

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
    title: "Your pipeline fills itself.",
    body: "Six stages from applied to offer. The agent logs each application as it lands, so the funnel and its analytics stay current without you entering anything by hand.",
    panel: <WorkspacePanel />,
    glow: alpha(accent.primary, 0.07),
  },
  {
    eyebrow: "INBOX",
    title: "Recruiter replies, matched to the right application",
    body: "JobPilot reads recruiter replies from your Gmail, classifies them, and pairs each with the application it belongs to. You approve the status move; nothing changes without you.",
    panel: <InboxPanel />,
    glow: alpha(accent.secondary, 0.07),
  },
  {
    eyebrow: "RESUME STUDIO",
    title: "Every job gets its own resume",
    body: "Keep one base resume; the agent tailors a variant for each application and renders it to PDF live. You always know which version went where.",
    panel: <ResumePanel />,
    glow: alpha(feedback.success, 0.06),
  },
  {
    eyebrow: "UPWORK",
    title: "Only the Upwork jobs worth bidding on.",
    body: "Client-quality filters drop low hire rates and empty spend histories before ranking what's left. Proposals and profile improvements are drafted for your approval.",
    panel: <UpworkPanel />,
    glow: alpha(accent.primary, 0.07),
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
              <SectionGlow color={row.glow} />
              <Box sx={{ position: "relative" }}>{row.panel}</Box>
            </Grid>
          </Grid>
        ))}
      </Stack>
    </Section>
  );
}
