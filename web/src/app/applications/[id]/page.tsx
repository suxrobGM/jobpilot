import type { ReactElement } from "react";
import { ApplicationDetail } from "@/components/features/applications/application-detail";

interface ApplicationDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function ApplicationDetailPage(
  props: ApplicationDetailPageProps,
): Promise<ReactElement> {
  const { id } = await props.params;
  return <ApplicationDetail id={Number(id)} />;
}
