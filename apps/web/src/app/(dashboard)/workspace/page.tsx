import type { ReactElement } from "react";
import { Container } from "@mui/material";
import { WorkspaceActionsProvider, WorkspaceView } from "@/components/features/workspace";
import { PageHeader } from "@/components/ui/layout";

export default function WorkspacePage(): ReactElement {
  return (
    <WorkspaceActionsProvider>
      <Container maxWidth="xl" sx={{ flex: 1, minHeight: 0 }}>
        <PageHeader eyebrow="Workspace" title="Workspace" />
        <WorkspaceView />
      </Container>
    </WorkspaceActionsProvider>
  );
}
