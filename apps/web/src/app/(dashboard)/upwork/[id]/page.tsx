import type { ReactElement } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProposalDetail } from "@/components/features/upwork";

export const metadata: Metadata = { title: "Proposal" };

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
