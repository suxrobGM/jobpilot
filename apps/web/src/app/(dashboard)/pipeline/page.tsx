import type { ReactElement } from "react";
import type { Metadata } from "next";
import { PipelineView } from "@/components/features/pipeline";
import { PageHeader, PageShell } from "@/components/ui/layout";

export const metadata: Metadata = { title: "Pipeline" };

export default function PipelinePage(): ReactElement {
  return (
    <PageShell maxWidth="xl">
      <PageHeader
        title="Pipeline"
        description="Every job the pilot found, scored, applied to or set aside, across all your searches and feeds."
      />
      <PipelineView />
    </PageShell>
  );
}
