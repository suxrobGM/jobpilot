import type { ReactElement, ReactNode } from "react";
import { PageHeader, PageShell } from "@/components/ui/layout";
import { type Tab, TabStrip } from "@/components/ui/navigation";

const TABS: Tab[] = [
  { label: "Resumes", href: "/documents/resumes" },
  { label: "Cover Letters", href: "/documents/cover-letters" },
  { label: "Portfolio", href: "/documents/portfolio" },
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
        description="Base resumes, tailored variants, cover letters, and your public portfolio."
      />
      <TabStrip tabs={TABS} ariaLabel="Document types" />
      {children}
    </PageShell>
  );
}
