import type { ReactElement } from "react";
import { Stack } from "@mui/material";
import { AutopilotRunButton, RunsContent } from "@/components/features/runs";
import { PageHeader } from "@/components/ui/layout/page-header";

export default function RunsPage(): ReactElement {
  return (
    <Stack spacing={2}>
      <PageHeader
        eyebrow="History"
        title="Runs"
        description="Autopilot and apply runs. Click a row for the live viewer."
        actions={<AutopilotRunButton />}
      />
      <RunsContent />
    </Stack>
  );
}
