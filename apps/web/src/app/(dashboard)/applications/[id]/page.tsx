import { type ReactElement, Suspense } from "react";
import type { Metadata } from "next";
import { ApplicationDetail } from "@/components/features/applications/application-detail";
import { DetailSkeleton } from "@/components/ui/feedback";

export const metadata: Metadata = { title: "Application" };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function ApplicationDetailPage(props: PageProps): ReactElement {
  return (
    <Suspense fallback={<DetailSkeleton />}>
      <Application params={props.params} />
    </Suspense>
  );
}

async function Application(props: PageProps): Promise<ReactElement> {
  const { id } = await props.params;

  return <ApplicationDetail applicationId={id} />;
}
