import type { ReactElement } from "react";
import { Container } from "@mui/material";
import { PilotView } from "@/components/features/pilot";
import { PageHeader } from "@/components/ui/layout";

export default function PilotPage(): ReactElement {
  return (
    <Container maxWidth="lg" sx={{ gap: 2 }}>
      <PageHeader
        eyebrow="Workspace"
        title="Pilot"
        description="Run JobPilot autonomously: set your instructions, watch its journal, and answer escalations."
      />
      <PilotView />
    </Container>
  );
}
