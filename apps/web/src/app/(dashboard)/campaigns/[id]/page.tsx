import { cache, type ReactElement, Suspense } from "react";
import type { Metadata } from "next";
import { api } from "@/api/client";
import { getFetchOptions } from "@/api/server";
import { CampaignDetail } from "@/components/features/campaigns";
import { DetailSkeleton } from "@/components/ui/feedback";
import { PageShell } from "@/components/ui/layout";

interface PageProps {
  params: Promise<{ id: string }>;
}

/** Shared by the title and the client's initialData; a failed read leaves both to the client. */
const getCampaign = cache(async (id: string) => {
  const { data } = await api.campaigns({ id }).get(await getFetchOptions());
  return data;
});

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const { id } = await props.params;
  const campaign = await getCampaign(id);
  return { title: campaign?.query ?? "Campaign" };
}

export default function CampaignDetailPage(props: PageProps): ReactElement {
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
  return <CampaignDetail campaignId={id} initialCampaign={await getCampaign(id)} />;
}
