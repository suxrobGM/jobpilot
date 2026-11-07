import type { ReactElement } from "react";
import type { Metadata } from "next";
import { AnalyticsView } from "@/components/features/analytics/analytics-view";
import { PortfolioActions } from "@/components/features/analytics/portfolio-actions";
import { PageHeader, PageShell } from "@/components/ui/layout";

export const metadata: Metadata = { title: "Analytics" };

export default function AnalyticsPage(): ReactElement {
  return (
    <PageShell maxWidth="xl">
      <PageHeader title="Analytics" />
      <PortfolioActions />
      <AnalyticsView />
    </PageShell>
  );
}
