import type { ReactElement } from "react";
import type { Metadata } from "next";
import { GoalsAndRules } from "@/components/features/pilot";
import { PageHeader, PageShell } from "@/components/ui/layout";

export const metadata: Metadata = { title: "Goals & rules" };

export default function PilotGoalsPage(): ReactElement {
  return (
    <PageShell maxWidth="lg">
      <PageHeader title="Goals & rules" backHref="/pilot" backLabel="Pilot" />
      <GoalsAndRules />
    </PageShell>
  );
}
