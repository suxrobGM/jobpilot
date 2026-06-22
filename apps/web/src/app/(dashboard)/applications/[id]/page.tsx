import type { ReactElement } from "react";
import { notFound } from "next/navigation";
import { api } from "@/api/client";
import { getFetchOptions } from "@/api/server";
import { ApplicationDetail } from "@/components/features/applications";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ApplicationDetailPage(props: PageProps): Promise<ReactElement> {
  const { id } = await props.params;

  if (!id) {
    notFound();
  }

  const opts = await getFetchOptions();
  const { data } = await api.applied({ id }).get(opts);

  if (!data) {
    notFound();
  }

  return <ApplicationDetail initialApplication={data} />;
}
