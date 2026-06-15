import type { ReactElement } from "react";
import { Container } from "@mui/material";
import type { Route } from "next";
import { CampaignDetail } from "@/components/features/campaigns";
import { PageHeader } from "@/components/ui/layout";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function CampaignDetailPage(props: PageProps): Promise<ReactElement> {
  const { id } = await props.params;
  return (
    <Container maxWidth="lg" sx={{ gap: 2 }}>
      <PageHeader
        eyebrow="Campaign"
        title={id}
        backHref={`/?campaignId=${encodeURIComponent(id)}` as Route}
        backLabel="Pipeline"
      />
      <CampaignDetail campaignId={id} />
    </Container>
  );
}
