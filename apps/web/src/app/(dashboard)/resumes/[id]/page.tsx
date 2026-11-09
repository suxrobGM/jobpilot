import { type ReactElement, Suspense } from "react";
import type { Metadata } from "next";
import { ResumeDetail } from "@/components/features/resumes";
import { DetailSkeleton } from "@/components/ui/feedback";

export const metadata: Metadata = { title: "Resume" };

interface PageProps {
  params: Promise<{ id: string }>;
}

/** Full-bleed, no PageShell: the editor and the PDF preview each take a full-height column. */
export default function ResumeDetailPage(props: PageProps): ReactElement {
  return (
    <Suspense fallback={<DetailSkeleton heights={[560]} />}>
      <Resume params={props.params} />
    </Suspense>
  );
}

async function Resume(props: PageProps): Promise<ReactElement> {
  const { id } = await props.params;
  return <ResumeDetail resumeId={id} />;
}
