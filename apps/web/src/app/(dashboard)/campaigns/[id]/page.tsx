import { type ReactElement, Suspense } from "react";
import type { Metadata } from "next";
import { api } from "@/api/client";
import { getFetchOptions } from "@/api/server";
import { CampaignDetail } from "@/components/features/campaigns";
import { DetailSkeleton } from "@/components/ui/feedback";
import { PageShell } from "@/components/ui/layout";

interface PageProps {
  params: Promise<{ id: string }>;
}

/** Only the tab title is server-fetched; a failed read just keeps the generic one. */
export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const { id } = await props.params;
  const { data } = await api.campaigns({ id }).get(await getFetchOptions());
  return { title: data?.query ?? "Campaign" };
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
  return <CampaignDetail campaignId={id} />;
}
