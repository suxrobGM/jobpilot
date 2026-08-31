import { cache, type ReactElement } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { api } from "@/api/client";
import { dataOrThrow } from "@/api/error";
import { getFetchOptions } from "@/api/server";
import { CampaignDetail } from "@/components/features/campaigns";
import { PageHeader, PageShell } from "@/components/ui/layout";

interface PageProps {
  params: Promise<{ id: string }>;
}

/** Called by both generateMetadata and the page; `cache` collapses that to one request. */
const getCampaign = cache(async (id: string) =>
  dataOrThrow(
    await api.campaigns({ id }).get(await getFetchOptions()),
    "Couldn't load this campaign",
  ),
);

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const { id } = await props.params;
  const campaign = await getCampaign(id);
  return { title: campaign?.query ?? "Campaign" };
}

export default async function CampaignDetailPage(props: PageProps): Promise<ReactElement> {
  const { id } = await props.params;
  const campaign = await getCampaign(id);

  if (!campaign) {
    notFound();
  }

  return (
    <PageShell maxWidth="lg">
      <PageHeader
        eyebrow="Campaign"
        title={campaign.query}
        backHref="/workspace"
        backLabel="Workspace"
      />
      <CampaignDetail campaignId={id} />
    </PageShell>
  );
}
