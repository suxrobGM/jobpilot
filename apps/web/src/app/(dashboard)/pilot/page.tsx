import type { ReactElement } from "react";
import type { Metadata } from "next";
import { PilotHome } from "@/components/features/pilot";
import { PageShell } from "@/components/ui/layout";

export const metadata: Metadata = { title: "Pilot" };

export default function PilotPage(): ReactElement {
  return (
    <PageShell maxWidth="xl">
      <PilotHome />
    </PageShell>
  );
}
