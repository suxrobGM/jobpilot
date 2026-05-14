import type { ReactElement } from "react";
import { Stack } from "@mui/material";
import { ResumeListViewer } from "@/components/features/resumes";
import { PageHeader } from "@/components/ui/layout/page-header";

export default function ResumesIndexPage(): ReactElement {
  return (
    <Stack spacing={3}>
      <PageHeader
        eyebrow="Profile"
        title="Resumes"
        description="Your base resumes and the tailored variants AI produces from them. Upload a PDF to bootstrap a new base, or open one to edit its structure."
      />
      <ResumeListViewer />
    </Stack>
  );
}
