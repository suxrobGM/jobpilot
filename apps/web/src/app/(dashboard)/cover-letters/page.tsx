import type { ReactElement } from "react";
import type { Metadata } from "next";
import { CoverLettersList } from "@/components/features/cover-letters";
import { ResumeTabs } from "@/components/features/resumes/resume-tabs";
import { PageHeader, PageShell } from "@/components/ui/layout";

export const metadata: Metadata = { title: "Cover letters" };

export default function CoverLettersPage(): ReactElement {
  return (
    <PageShell maxWidth="lg">
      <PageHeader title="Cover letters" tabs={<ResumeTabs />} />
      <CoverLettersList />
    </PageShell>
  );
}
