import type { ReactElement, ReactNode } from "react";
import { PageHeader, PageShell } from "@/components/ui/layout";
import { type Tab, TabStrip } from "@/components/ui/navigation";

const TABS: Tab[] = [
  { label: "Resumes", href: "/documents/resumes" },
  { label: "Cover Letters", href: "/documents/cover-letters" },
];

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
      <TabStrip tabs={TABS} ariaLabel="Document types" />
      {children}
    </PageShell>
  );
}
