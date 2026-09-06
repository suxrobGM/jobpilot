import { cache, type ReactElement, Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { api } from "@/api/client";
import { dataOrThrow } from "@/api/error";
import { getFetchOptions } from "@/api/server";
import { CampaignDetail } from "@/components/features/campaigns";
import { DetailSkeleton } from "@/components/ui/data";
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

export default function CampaignDetailPage(props: PageProps): ReactElement {
  // The header title is the campaign's own query, so it streams with the detail.
  return (
    <PageShell maxWidth="lg">
      <Suspense fallback={<DetailSkeleton />}>
        <Campaign params={props.params} />
      </Suspense>
    </PageShell>
  );
}

async function Campaign(props: PageProps): Promise<ReactElement> {
  const { id } = await props.params;
  const campaign = await getCampaign(id);

  if (!campaign) {
    notFound();
  }

  return (
    <>
      <PageHeader
        eyebrow="Campaign"
        title={campaign.query}
        backHref="/workspace"
        backLabel="Workspace"
      />
      <CampaignDetail campaignId={id} />
    </>
  );
}
