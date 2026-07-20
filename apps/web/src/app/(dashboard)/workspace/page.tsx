import type { ReactElement } from "react";
import { Container } from "@mui/material";
import { WorkspaceActionsProvider, WorkspaceView } from "@/components/features/workspace";
import { PageHeader } from "@/components/ui/layout";

export default function WorkspacePage(): ReactElement {
  return (
    <WorkspaceActionsProvider>
      {/* Flex column: WorkspaceView owns the page's only scroll region and needs a bounded height. */}
      <Container
        maxWidth="xl"
        sx={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}
      >
        <PageHeader eyebrow="Workspace" title="Workspace" />
        <WorkspaceView />
      </Container>
    </WorkspaceActionsProvider>
  );
}
