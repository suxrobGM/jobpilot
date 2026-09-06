import { type ReactElement, Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProposalDetail } from "@/components/features/upwork";
import { DetailSkeleton } from "@/components/ui/data";

export const metadata: Metadata = { title: "Proposal" };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function ProposalDetailPage(props: PageProps): ReactElement {
  return (
    <Suspense fallback={<DetailSkeleton />}>
      <Proposal params={props.params} />
    </Suspense>
  );
}

async function Proposal(props: PageProps): Promise<ReactElement> {
  const { id } = await props.params;

  if (!id) {
    notFound();
  }

  return <ProposalDetail id={id} />;
}
