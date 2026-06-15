import type { ReactElement } from "react";
import { notFound } from "next/navigation";
import type { ApplicationDetailDto } from "@/api/types";
import { serverGet } from "@/api/server-fetch";
import { ApplicationDetail } from "@/components/features/applications";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ApplicationDetailPage(props: PageProps): Promise<ReactElement> {
  const { id: idParam } = await props.params;
  const id = Number(idParam);

  if (!Number.isInteger(id)) {
    notFound();
  }

  const { data } = await serverGet<ApplicationDetailDto>(`/api/applied/${id}`);
  if (!data) {
    notFound();
  }

  return <ApplicationDetail initialApplication={data} />;
}
