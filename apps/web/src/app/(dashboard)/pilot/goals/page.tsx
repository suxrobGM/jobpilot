import type { ReactElement } from "react";
import type { Metadata } from "next";
import { InstructionsForm } from "@/components/features/pilot";
import { PageHeader, PageShell } from "@/components/ui/layout";

export const metadata: Metadata = { title: "Goals & rules" };

export default function PilotGoalsPage(): ReactElement {
  return (
    <PageShell maxWidth="lg">
      <PageHeader
        eyebrow="Pilot"
        title="Goals & rules"
        description="What you want, and the limits the pilot keeps to while it gets there."
      />
      <InstructionsForm variant="goals" />
    </PageShell>
  );
}
