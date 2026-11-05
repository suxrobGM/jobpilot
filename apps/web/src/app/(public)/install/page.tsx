import type { ReactElement } from "react";
import { Stack, Typography } from "@mui/material";
import type { Metadata } from "next";
import { InstallGuide } from "@/components/features/install";
import { MarketingMain } from "@/components/layout";

export const ensureStatic = "navigation";

export const metadata: Metadata = {
  title: "Install JobPilot",
  description:
    "Add the JobPilot plugin to Claude Code or Codex, run setup, and create your account.",
  alternates: { canonical: "/install" },
};

export default function InstallPage(): ReactElement {
  return (
    <MarketingMain maxWidth="md">
      <Stack spacing={4} sx={{ paddingBlock: { md: 4 } }}>
        <Stack spacing={2}>
          <Typography variant="eyebrow" color="primary">
            Get started
          </Typography>
          <Typography variant="displayLg">Install JobPilot</Typography>
          <Typography variant="lead" sx={{ maxWidth: 560 }}>
            JobPilot is a plugin for Claude Code and Codex. Add it, run setup, and create an
            account. After that you control everything from the dashboard.
          </Typography>
        </Stack>
        <InstallGuide />
      </Stack>
    </MarketingMain>
  );
}
