import type { ReactElement } from "react";
import { notFound } from "next/navigation";
import { ProposalDetail } from "@/components/features/upwork";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ProposalDetailPage(props: PageProps): Promise<ReactElement> {
  const { id } = await props.params;

  if (!id) {
    notFound();
  }

  return <ProposalDetail id={id} />;
}
