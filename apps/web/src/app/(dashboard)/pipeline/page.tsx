import type { ReactElement } from "react";
import type { Metadata } from "next";
import { PipelineView } from "@/components/features/pipeline";
import { PageShell } from "@/components/ui/layout";

export const metadata: Metadata = { title: "Pipeline" };

/** PipelineView renders its own header: the tab counts and filters are client state. */
export default function PipelinePage(): ReactElement {
  return (
    <PageShell maxWidth="xl">
      <PipelineView />
    </PageShell>
  );
}
