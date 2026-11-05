import { type ReactElement, Suspense } from "react";
import type { Metadata } from "next";
import { CampaignComposer } from "@/components/features/campaigns";
import { DetailSkeleton } from "@/components/ui/feedback";
import { PageHeader, PageShell } from "@/components/ui/layout";

export const metadata: Metadata = { title: "New campaign" };

interface NewCampaignPageProps {
  searchParams: Promise<{ board?: string }>;
}

export default function NewCampaignPage(props: NewCampaignPageProps): ReactElement {
  return (
    <PageShell maxWidth="md">
      <PageHeader
        eyebrow="Campaign"
        title="Start a new campaign"
        description="Search a job board or the open web, score matches, and optionally batch-apply."
      />
      {/* `?board=` preselects the board, so only the composer waits on the URL. */}
      <Suspense fallback={<DetailSkeleton heights={[480]} />}>
        <Composer searchParams={props.searchParams} />
      </Suspense>
    </PageShell>
  );
}

async function Composer(props: NewCampaignPageProps): Promise<ReactElement> {
  const { board } = await props.searchParams;
  return <CampaignComposer defaultBoard={board} />;
}
