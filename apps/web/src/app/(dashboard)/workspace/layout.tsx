import type { ReactElement, ReactNode } from "react";
import { StealthCodeBanner } from "@/components/features/workspace/stealth-code-banner";
import { WorkspaceLive } from "@/components/features/workspace/workspace-live";
import { PageHeader, PageShell } from "@/components/ui/layout";
import { type Tab, TabStrip } from "@/components/ui/navigation";

const TABS: Tab[] = [
  { label: "Overview", href: "/workspace" },
  { label: "Applications", href: "/workspace/applications" },
];

interface WorkspaceLayoutProps {
  children: ReactNode;
}

export default function WorkspaceLayout(props: WorkspaceLayoutProps): ReactElement {
  const { children } = props;
  return (
    <PageShell maxWidth="xl">
      <PageHeader
        title="Workspace"
        description="Your campaigns, applications, and pilot at a glance."
      />
      <TabStrip tabs={TABS} ariaLabel="Workspace sections" />
      {/* In the layout so the subscription survives tab navigation. */}
      <WorkspaceLive />
      {children}
      <StealthCodeBanner />
    </PageShell>
  );
}
