import type { ReactElement } from "react";
import type { Metadata } from "next";
import { AnalyticsView } from "@/components/features/analytics";
import { PageHeader, PageShell } from "@/components/ui/layout";

export const metadata: Metadata = { title: "Analytics" };

export default function AnalyticsPage(): ReactElement {
  return (
    <PageShell maxWidth="xl">
      <PageHeader
        eyebrow="Workspace"
        title="Analytics"
        description="Roll-up stats across your applications, campaigns, and networking."
      />
      <AnalyticsView />
    </PageShell>
  );
}
