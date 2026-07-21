import type { ReactElement } from "react";
import type { Metadata } from "next";
import { ProfileEnhancer } from "@/components/features/upwork";
import { PageHeader, PageShell } from "@/components/ui/layout";

export const metadata: Metadata = { title: "Upwork profile" };

export default function UpworkProfilePage(): ReactElement {
  return (
    <PageShell maxWidth="lg">
      <PageHeader
        eyebrow="Upwork"
        title="Profile enhancement"
        description="Sharpen your Upwork overview and portfolio from your résumé, then push the approved version to your live profile."
        backHref="/upwork"
        backLabel="Proposals"
      />
      <ProfileEnhancer />
    </PageShell>
  );
}
