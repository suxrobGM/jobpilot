import type { ReactElement } from "react";
import type { Metadata } from "next";
import { PortfolioSettings } from "@/components/features/portfolio";
import { PageHeader, PageShell } from "@/components/ui/layout";

export const metadata: Metadata = { title: "Portfolio" };

export default function PortfolioPage(): ReactElement {
  return (
    <PageShell maxWidth="xl">
      <PageHeader title="Portfolio" />
      <PortfolioSettings />
    </PageShell>
  );
}
