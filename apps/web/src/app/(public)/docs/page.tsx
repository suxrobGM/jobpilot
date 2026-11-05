import type { ReactElement } from "react";
import { Stack, Typography } from "@mui/material";
import type { Metadata } from "next";
import { DocsIndexCards } from "@/components/features/docs";

const description =
  "How to set up and use JobPilot: installing the agent, the Pilot, campaigns, email, and credentials.";

export const metadata: Metadata = {
  title: "Docs",
  description,
  alternates: { canonical: "/docs" },
  openGraph: { type: "article", url: "/docs", title: "Docs · JobPilot", description },
  twitter: { title: "Docs · JobPilot", description },
};

export default function DocsIndexPage(): ReactElement {
  return (
    <Stack spacing={3}>
      <Stack spacing={1.5}>
        <Typography variant="docsH1">JobPilot docs</Typography>
        <Typography variant="docsBody">
          JobPilot is an AI agent that applies to jobs for you. Your profile, resumes, and
          applications live on the JobPilot website. The agent runs on your own computer, using your
          Claude Code or Codex subscription, and works in a normal browser window. You don't need an
          API key, and JobPilot is free.
        </Typography>
        <Typography variant="docsBody">
          The agent searches job boards, scores each job against your resume, makes a tailored
          resume for each application, fills in the form, and matches replies from recruiters to the
          right application. You can start each task yourself from the dashboard, or turn on the
          Pilot and let it run the whole search. These guides cover setup and day-to-day use.
        </Typography>
      </Stack>
      <DocsIndexCards />
    </Stack>
  );
}
