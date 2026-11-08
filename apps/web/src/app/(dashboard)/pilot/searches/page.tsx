import type { ReactElement } from "react";
import type { Metadata } from "next";
import { SearchesAndRules } from "@/components/features/pilot";
import { PageHeader, PageShell } from "@/components/ui/layout";

export const metadata: Metadata = { title: "Searches & rules" };

export default function PilotSearchesPage(): ReactElement {
  return (
    <PageShell maxWidth="lg">
      <PageHeader title="Searches & rules" backHref="/pilot" backLabel="Pilot" />
      <SearchesAndRules />
    </PageShell>
  );
}
