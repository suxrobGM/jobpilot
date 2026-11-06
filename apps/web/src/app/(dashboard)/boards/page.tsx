import type { ReactElement } from "react";
import type { Metadata } from "next";
import { BoardsSection } from "@/components/features/boards/boards-section";
import { CredentialsSection } from "@/components/features/boards/credentials-section";
import { PageHeader, PageShell } from "@/components/ui/layout";

export const metadata: Metadata = { title: "Job boards" };

export default function BoardsPage(): ReactElement {
  return (
    <PageShell maxWidth="md">
      <PageHeader
        title="Job boards"
        description="Where the pilot searches, in what order, and the logins it signs in with."
      />
      <BoardsSection />
      <CredentialsSection />
    </PageShell>
  );
}
