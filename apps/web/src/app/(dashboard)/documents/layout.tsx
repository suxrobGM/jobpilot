import type { ReactElement, ReactNode } from "react";
import { DocumentsTabs } from "@/components/features/documents";
import { PageHeader, PageShell } from "@/components/ui/layout";

interface DocumentsLayoutProps {
  children: ReactNode;
}

export default function DocumentsLayout(props: DocumentsLayoutProps): ReactElement {
  const { children } = props;
  return (
    <PageShell maxWidth="lg">
      <PageHeader
        eyebrow="Library"
        title="Documents"
        description="Base resumes, AI-tailored variants, and generated cover letters."
      />
      <DocumentsTabs />
      {children}
    </PageShell>
  );
}
