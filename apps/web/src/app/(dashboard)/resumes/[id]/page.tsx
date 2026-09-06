import { type ReactElement, Suspense } from "react";
import { Skeleton } from "@mui/material";
import type { Metadata } from "next";
import { ResumeDetail } from "@/components/features/resumes";
import { PageHeader, PageShell } from "@/components/ui/layout";

export const metadata: Metadata = { title: "Resume" };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function ResumeDetailPage(props: PageProps): ReactElement {
  return (
    <PageShell maxWidth="xl">
      <PageHeader
        eyebrow="Documents"
        title="Edit resume"
        description="Structured fields render to PDF on the right. Variants tailored from this base appear below."
      />
      <Suspense fallback={<Skeleton variant="rounded" height={560} />}>
        <Resume params={props.params} />
      </Suspense>
    </PageShell>
  );
}

async function Resume(props: PageProps): Promise<ReactElement> {
  const { id } = await props.params;
  return <ResumeDetail resumeId={id} />;
}
