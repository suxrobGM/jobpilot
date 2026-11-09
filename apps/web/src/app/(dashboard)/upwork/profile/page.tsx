import type { ReactElement } from "react";
import type { Metadata } from "next";
import { ProfileEnhancer } from "@/components/features/upwork";
import { PageHeader, PageShell } from "@/components/ui/layout";

export const metadata: Metadata = { title: "Upwork profile" };

export default function UpworkProfilePage(): ReactElement {
  return (
    <PageShell maxWidth="lg">
      <PageHeader title="Profile enhancement" backHref="/upwork" backLabel="Proposals" />
      <ProfileEnhancer />
    </PageShell>
  );
}
