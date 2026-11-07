import type { ReactElement } from "react";
import type { Metadata } from "next";
import { ProposalsList, UpworkHeader } from "@/components/features/upwork";
import { PageShell } from "@/components/ui/layout";

export const metadata: Metadata = { title: "Upwork" };

export default function UpworkPage(): ReactElement {
  return (
    <PageShell maxWidth="lg">
      <UpworkHeader />
      <ProposalsList />
    </PageShell>
  );
}
