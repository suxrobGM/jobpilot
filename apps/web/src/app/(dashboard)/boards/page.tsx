import type { ReactElement } from "react";
import type { Metadata } from "next";
import { AddBoardButton } from "@/components/features/boards/add-board-button";
import { BoardsContent } from "@/components/features/boards/boards-content";
import { PageHeader, PageShell } from "@/components/ui/layout";

export const metadata: Metadata = { title: "Boards" };

export default function BoardsPage(): ReactElement {
  return (
    <PageShell maxWidth="lg">
      <PageHeader
        eyebrow="Configure"
        title="Job boards"
        description="Sites the search and apply skills can use. Pick one when launching a campaign."
        actions={<AddBoardButton />}
      />
      <BoardsContent />
    </PageShell>
  );
}
