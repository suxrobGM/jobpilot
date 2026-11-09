import type { ReactElement } from "react";
import type { Metadata } from "next";
import { AddBoardButton } from "@/components/features/boards/add-board-button";
import { BoardsSection } from "@/components/features/boards/boards-section";
import { CredentialsSection } from "@/components/features/boards/credentials-section";
import { PageHeader, PageShell } from "@/components/ui/layout";

export const metadata: Metadata = { title: "Job boards" };

export default function BoardsPage(): ReactElement {
  return (
    <PageShell maxWidth="md">
      <PageHeader title="Job boards" actions={<AddBoardButton />} />
      <BoardsSection />
      <CredentialsSection />
    </PageShell>
  );
}
