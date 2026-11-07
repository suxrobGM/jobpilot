import { type ReactElement, Suspense } from "react";
import type { Metadata } from "next";
import { ParkedJobPage } from "@/components/features/pilot";
import { DetailSkeleton } from "@/components/ui/feedback";
import { PageShell } from "@/components/ui/layout";

export const metadata: Metadata = { title: "Parked job" };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function PilotJobPage(props: PageProps): ReactElement {
  return (
    <PageShell maxWidth="md">
      <Suspense fallback={<DetailSkeleton heights={[120, 320]} />}>
        <ParkedJob params={props.params} />
      </Suspense>
    </PageShell>
  );
}

async function ParkedJob(props: PageProps): Promise<ReactElement> {
  const { id } = await props.params;

  return <ParkedJobPage jobId={id} />;
}
