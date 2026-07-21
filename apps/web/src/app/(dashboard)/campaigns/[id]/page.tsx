import type { ReactElement } from "react";
import type { Metadata } from "next";
import { CampaignDetail } from "@/components/features/campaigns";
import { PageHeader, PageShell } from "@/components/ui/layout";

export const metadata: Metadata = { title: "Campaign" };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function CampaignDetailPage(props: PageProps): Promise<ReactElement> {
  const { id } = await props.params;
  return (
    <PageShell maxWidth="lg">
      <PageHeader eyebrow="Campaign" title={id} backHref="/workspace" backLabel="Workspace" />
      <CampaignDetail campaignId={id} />
    </PageShell>
  );
}
