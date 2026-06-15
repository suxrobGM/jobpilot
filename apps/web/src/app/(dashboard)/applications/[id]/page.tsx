import type { ReactElement } from "react";
import { notFound } from "next/navigation";
import { serverApi } from "@/api/server-api";
import { ApplicationDetail } from "@/components/features/applications";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ApplicationDetailPage(props: PageProps): Promise<ReactElement> {
  const { id } = await props.params;

  if (!Number.isInteger(Number(id))) {
    notFound();
  }

  const api = await serverApi();
  const { data } = await api.applied({ id }).get();
  if (!data) {
    notFound();
  }

  return <ApplicationDetail initialApplication={data} />;
}
