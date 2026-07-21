import type { ReactElement, ReactNode } from "react";
import { PilotLive, PilotTabs } from "@/components/features/pilot";
import { PageHeader, PageShell } from "@/components/ui/layout";

interface PilotLayoutProps {
  children: ReactNode;
}

export default function PilotLayout(props: PilotLayoutProps): ReactElement {
  const { children } = props;
  return (
    <PageShell maxWidth="lg">
      <PageHeader
        eyebrow="Workspace"
        title="Pilot"
        description="Run JobPilot autonomously: set your instructions, watch its journal, and answer its questions."
      />
      <PilotTabs />
      {/* Lives in the layout so the shared pilot SSE subscription survives tab navigation. */}
      <PilotLive />
      {children}
    </PageShell>
  );
}
