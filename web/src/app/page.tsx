import type { ReactElement } from "react";
import { DashboardContent } from "@/components/features/dashboard/dashboard-content";
import { PageHeader } from "@/components/ui/layout/page-header";
import { PageShell } from "@/components/ui/layout/page-shell";

export default function HomePage(): ReactElement {
  return (
    <PageShell maxWidth="lg">
      <PageHeader
        eyebrow="JobPilot"
        title="Dashboard"
        description="Snapshot of your job search across every board and skill."
      />
      <DashboardContent />
    </PageShell>
  );
}
