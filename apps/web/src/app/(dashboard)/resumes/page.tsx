import type { ReactElement } from "react";
import type { Metadata } from "next";
import { ResumesList } from "@/components/features/resumes";
import { ResumeTabs } from "@/components/features/resumes/resume-tabs";
import { PageHeader, PageShell } from "@/components/ui/layout";

export const metadata: Metadata = { title: "Resumes" };

export default function ResumesPage(): ReactElement {
  return (
    <PageShell maxWidth="lg">
      <PageHeader title="Resumes" tabs={<ResumeTabs />} />
      <ResumesList />
    </PageShell>
  );
}
