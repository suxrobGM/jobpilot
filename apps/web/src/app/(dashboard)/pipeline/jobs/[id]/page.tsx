import { type ReactElement, Suspense } from "react";
import type { Metadata } from "next";
import { JobPage } from "@/components/features/pipeline";
import { DetailSkeleton } from "@/components/ui/feedback";
import { PageShell } from "@/components/ui/layout";

export const metadata: Metadata = { title: "Job" };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function PipelineJobPage(props: PageProps): ReactElement {
  return (
    <PageShell maxWidth="md">
      <Suspense fallback={<DetailSkeleton heights={[120, 320]} />}>
        <Job params={props.params} />
      </Suspense>
    </PageShell>
  );
}

async function Job(props: PageProps): Promise<ReactElement> {
  const { id } = await props.params;

  return <JobPage jobId={id} />;
}
