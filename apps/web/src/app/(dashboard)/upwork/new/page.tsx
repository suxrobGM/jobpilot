import type { ReactElement } from "react";
import type { Metadata } from "next";
import { ProposalComposer } from "@/components/features/upwork";
import { PageHeader, PageShell } from "@/components/ui/layout";

export const metadata: Metadata = { title: "New proposal" };

export default function NewProposalPage(): ReactElement {
  return (
    <PageShell maxWidth="md">
      <PageHeader
        eyebrow="Upwork"
        title="New proposal"
        description="Paste a job posting; the proposal skill drafts a targeted proposal in the terminal."
        backHref="/upwork"
        backLabel="Proposals"
      />
      <ProposalComposer />
    </PageShell>
  );
}
