import type { ReactElement } from "react";
import { notFound } from "next/navigation";
import { ApplicationDetail } from "@/components/features/applications";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ApplicationDetailPage(props: PageProps): Promise<ReactElement> {
  const { id } = await props.params;

  if (!id) {
    notFound();
  }

  return <ApplicationDetail applicationId={id} />;
}
