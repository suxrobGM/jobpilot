import type { ReactElement } from "react";
import { Stack } from "@mui/material";
import { ResumeDetail } from "@/components/features/resumes";
import { PageHeader } from "@/components/ui/layout";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ResumeDetailPage(props: PageProps): Promise<ReactElement> {
  const { id } = await props.params;
  const numericId = Number(id);

  return (
    <Stack spacing={3}>
      <PageHeader
        eyebrow="Resumes"
        title="Edit resume"
        description="Structured fields render to PDF on the right. Variants tailored from this base appear below."
      />
      <ResumeDetail resumeId={numericId} />
    </Stack>
  );
}
