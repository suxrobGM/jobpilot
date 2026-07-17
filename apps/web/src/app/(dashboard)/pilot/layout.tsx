import type { ReactElement, ReactNode } from "react";
import { Container } from "@mui/material";
import { PilotLive, PilotTabs } from "@/components/features/pilot";
import { PageHeader } from "@/components/ui/layout/page-header";

interface PilotLayoutProps {
  children: ReactNode;
}

export default function PilotLayout(props: PilotLayoutProps): ReactElement {
  const { children } = props;
  return (
    <Container maxWidth="lg">
      <PageHeader
        eyebrow="Workspace"
        title="Pilot"
        description="Run JobPilot autonomously: set your instructions, watch its journal, and answer its questions."
      />
      <PilotTabs />
      {/* Lives in the layout so the shared pilot SSE subscription survives tab navigation. */}
      <PilotLive />
      {children}
    </Container>
  );
}
