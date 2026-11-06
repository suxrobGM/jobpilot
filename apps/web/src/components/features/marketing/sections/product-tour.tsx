"use client";

import { type ReactElement, useState } from "react";
import { Box, Grid, Stack, Tab, Tabs, Typography } from "@mui/material";
import { Glow } from "../glow";
import { InboxPanel } from "../mock-panels/inbox-panel";
import { PilotPanel } from "../mock-panels/pilot-panel";
import { PipelinePanel } from "../mock-panels/pipeline-panel";
import { ResumePanel } from "../mock-panels/resume-panel";
import { UpworkPanel } from "../mock-panels/upwork-panel";
import { Section } from "../section";
import { SectionHeading } from "../section-heading";

interface TourStop {
  id: string;
  label: string;
  title: string;
  body: string;
  panel: ReactElement;
}

const STOPS: TourStop[] = [
  {
    id: "pilot",
    label: "Pilot",
    title: "An assistant you can talk to.",
    body: "The Pilot reports what it did as it goes. Tell it what to change in plain words and it does it, with an Undo on every change.",
    panel: <PilotPanel />,
  },
  {
    id: "pipeline",
    label: "Pipeline",
    title: "Every job and application in one place.",
    body: "Each job the agent finds lands in your pipeline with its score. Applications follow on, so you can track each one from applied to offer without a spreadsheet.",
    panel: <PipelinePanel />,
  },
  {
    id: "inbox",
    label: "Inbox",
    title: "Replies sorted for you.",
    body: "JobPilot reads recruiter emails in your Gmail, works out whether each is an interview, a rejection, or an offer, and links it to the right application. You confirm before anything changes.",
    panel: <InboxPanel />,
  },
  {
    id: "resumes",
    label: "Resumes",
    title: "A tailored resume for each job.",
    body: "You keep one main resume. For each application the agent makes a copy aimed at that job and saves it as a PDF, so you can always see which version you sent where.",
    panel: <ResumePanel />,
  },
  {
    id: "upwork",
    label: "Upwork",
    title: "Upwork jobs worth bidding on.",
    body: "It skips clients who rarely hire or have never spent money, then ranks the rest. It drafts proposals and profile updates, and you approve each one.",
    panel: <UpworkPanel />,
  },
];

export function ProductTour(): ReactElement {
  const [activeIndex, setActiveIndex] = useState(0);
  const active = STOPS[activeIndex];

  return (
    <Section>
      <SectionHeading
        eyebrow="The dashboard"
        title="Everything the agent does, in one place."
        lead="The agent works on your computer. The dashboard is where you see the results and step in."
      />
      <Tabs
        value={activeIndex}
        onChange={(_, next: number) => setActiveIndex(next)}
        variant="scrollable"
        allowScrollButtonsMobile
        aria-label="Dashboard features"
        sx={{ mt: 4, mb: { xs: 4, md: 6 } }}
      >
        {STOPS.map((stop) => (
          <Tab
            key={stop.id}
            label={stop.label}
            id={`tour-tab-${stop.id}`}
            aria-controls="tour-panel"
          />
        ))}
      </Tabs>
      <Grid
        container
        spacing={{ xs: 4, md: 8 }}
        role="tabpanel"
        id="tour-panel"
        aria-labelledby={`tour-tab-${active.id}`}
        sx={{ alignItems: "center", minHeight: { md: 360 } }}
      >
        <Grid size={{ xs: 12, md: 5 }}>
          <Stack spacing={1.5}>
            <Typography variant="h3">{active.title}</Typography>
            <Typography variant="lead">{active.body}</Typography>
          </Stack>
        </Grid>
        <Grid size={{ xs: 12, md: 7 }} sx={{ position: "relative" }}>
          <Glow placement="center" bleed={48} />
          <Box sx={{ position: "relative" }}>{active.panel}</Box>
        </Grid>
      </Grid>
    </Section>
  );
}
