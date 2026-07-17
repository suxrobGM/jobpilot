import type { ReactElement, ReactNode } from "react";
import { Container } from "@mui/material";
import { DocumentsTabs } from "@/components/features/documents";
import { PageHeader } from "@/components/ui/layout/page-header";

interface DocumentsLayoutProps {
  children: ReactNode;
}

export default function DocumentsLayout(props: DocumentsLayoutProps): ReactElement {
  const { children } = props;
  return (
    <Container maxWidth="lg">
      <PageHeader
        eyebrow="Library"
        title="Documents"
        description="Base resumes, AI-tailored variants, and generated cover letters."
      />
      <DocumentsTabs />
      {children}
    </Container>
  );
}
