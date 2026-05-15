import type { ReactElement } from "react";
import { notFound } from "next/navigation";
import { ApplicationDetail } from "@/components/features/applications";
import { apiGet } from "@/lib/api/api-server";
import type { ApplicationDetailDto } from "@/types/api";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ApplicationDetailPage(props: PageProps): Promise<ReactElement> {
  const { id: idParam } = await props.params;
  const id = Number(idParam);
  if (!Number.isInteger(id)) notFound();

  const { data } = await apiGet<ApplicationDetailDto>(`/api/applied/${id}`);
  if (!data) notFound();

  return <ApplicationDetail initialApplication={data} />;
}
