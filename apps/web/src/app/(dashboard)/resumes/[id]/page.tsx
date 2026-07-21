import type { ReactElement } from "react";
import type { Metadata } from "next";
import { ResumeDetail } from "@/components/features/resumes";
import { PageHeader, PageShell } from "@/components/ui/layout";

export const metadata: Metadata = { title: "Resume" };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ResumeDetailPage(props: PageProps): Promise<ReactElement> {
  const { id } = await props.params;

  return (
    <PageShell maxWidth="xl">
      <PageHeader
        eyebrow="Documents"
        title="Edit resume"
        description="Structured fields render to PDF on the right. Variants tailored from this base appear below."
      />
      <ResumeDetail resumeId={id} />
    </PageShell>
  );
}
