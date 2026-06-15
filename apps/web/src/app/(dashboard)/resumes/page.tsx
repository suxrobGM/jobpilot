import type { ReactElement } from "react";
import { Container } from "@mui/material";
import { ResumesList } from "@/components/features/resumes";
import { PageHeader } from "@/components/ui/layout/page-header";

export default function ResumesIndexPage(): ReactElement {
  return (
    <Container maxWidth="lg" sx={{ gap: 2 }}>
      <PageHeader
        eyebrow="Profile"
        title="Resumes"
        description="Your base resumes and the tailored variants AI produces from them. Upload a PDF to bootstrap a new base, or open one to edit its structure."
      />
      <ResumesList />
    </Container>
  );
}
