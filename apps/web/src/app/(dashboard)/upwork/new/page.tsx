import type { ReactElement } from "react";
import { Container } from "@mui/material";
import { ProposalComposer } from "@/components/features/upwork";
import { PageHeader } from "@/components/ui/layout";

export default function NewProposalPage(): ReactElement {
  return (
    <Container maxWidth="md" sx={{ gap: 2 }}>
      <PageHeader
        eyebrow="Upwork"
        title="New proposal"
        description="Paste a job posting; the proposal skill drafts a targeted proposal in the terminal."
        backHref="/upwork"
        backLabel="Proposals"
      />
      <ProposalComposer />
    </Container>
  );
}
