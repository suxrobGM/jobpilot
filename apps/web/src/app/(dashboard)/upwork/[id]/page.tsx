import { type ReactElement, Suspense } from "react";
import type { Metadata } from "next";
import { ProposalDetail } from "@/components/features/upwork";
import { DetailSkeleton } from "@/components/ui/feedback";
import { PageShell } from "@/components/ui/layout";

export const metadata: Metadata = { title: "Proposal" };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function ProposalDetailPage(props: PageProps): ReactElement {
  return (
    <PageShell maxWidth="md">
      <Suspense fallback={<DetailSkeleton />}>
        <Proposal params={props.params} />
      </Suspense>
    </PageShell>
  );
}

async function Proposal(props: PageProps): Promise<ReactElement> {
  const { id } = await props.params;

  return <ProposalDetail id={id} />;
}
