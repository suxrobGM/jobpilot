import type { ReactElement } from "react";
import { Stack, Typography } from "@mui/material";
import type { Metadata } from "next";
import { DocsIndexCards } from "@/components/features/docs";

const description =
  "How to set up and use JobPilot: installing the agent, the Pilot, skills, email, and credentials.";

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
          JobPilot is an AI agent that applies to jobs for you. It runs on your computer, inside
          Claude Code or Codex, and uses your subscription, so there's no API key and no bill. Your
          profile, resumes, and applications live on this website.
        </Typography>
        <Typography variant="docsBody">
          You tell the Pilot what you want. It searches job boards, scores each job against your
          resume, tailors your resume, fills in the application, and matches recruiter replies to
          the right application. When it needs a decision, it asks.
        </Typography>
      </Stack>
      <DocsIndexCards />
    </Stack>
  );
}
