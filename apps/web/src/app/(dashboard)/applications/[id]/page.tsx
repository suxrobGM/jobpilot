import type { ReactElement } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ApplicationDetail } from "@/components/features/applications";

export const metadata: Metadata = { title: "Application" };

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
