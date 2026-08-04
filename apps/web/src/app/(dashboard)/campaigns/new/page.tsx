import type { ReactElement } from "react";
import type { Metadata } from "next";
import { CampaignComposer } from "@/components/features/campaigns";
import { PageHeader, PageShell } from "@/components/ui/layout";

export const metadata: Metadata = { title: "New campaign" };

interface NewCampaignPageProps {
  searchParams: Promise<{ board?: string; source?: string }>;
}

export default async function NewCampaignPage(props: NewCampaignPageProps): Promise<ReactElement> {
  const { board, source } = await props.searchParams;
  return (
    <PageShell maxWidth="md">
      <PageHeader
        eyebrow="Campaign"
        title="Start a new campaign"
        description="Search a job board, score matches, and optionally batch-apply."
      />
      <CampaignComposer
        defaultBoard={board}
        defaultMode={source === "apply" ? "apply" : undefined}
      />
    </PageShell>
  );
}
