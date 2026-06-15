import type { ReactElement } from "react";
import { Container } from "@mui/material";
import { CampaignComposer } from "@/components/features/campaigns";
import { PageHeader } from "@/components/ui/layout";

interface NewCampaignPageProps {
  searchParams: Promise<{ board?: string }>;
}

export default async function NewCampaignPage(props: NewCampaignPageProps): Promise<ReactElement> {
  const { board } = await props.searchParams;
  return (
    <Container maxWidth="md" sx={{ gap: 2 }}>
      <PageHeader
        eyebrow="Campaign"
        title="Start a new campaign"
        description="Search a job board, score matches, and optionally batch-apply."
      />
      <CampaignComposer defaultBoard={board} />
    </Container>
  );
}
