import type { ReactElement } from "react";
import { notFound } from "next/navigation";
import { ProposalDetail } from "@/components/features/upwork";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ProposalDetailPage(props: PageProps): Promise<ReactElement> {
  const { id: idParam } = await props.params;
  const id = Number(idParam);

  if (!Number.isInteger(id) || id <= 0) {
    notFound();
  }

  return <ProposalDetail id={id} />;
}
