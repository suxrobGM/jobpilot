import type { ReactElement } from "react";
import { Stack } from "@mui/material";
import { AddBoardButton, BoardsContent } from "@/components/features/boards";
import { PageHeader } from "@/components/ui/layout";

export default function BoardsPage(): ReactElement {
  return (
    <Stack spacing={3}>
      <PageHeader
        eyebrow="Configure"
        title="Job boards"
        description="Sites the search and apply skills will use. Add custom boards or disable ones you don't use."
        actions={<AddBoardButton />}
      />
      <BoardsContent />
    </Stack>
  );
}
