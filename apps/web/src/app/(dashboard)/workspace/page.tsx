import type { ReactElement } from "react";
import { Container } from "@mui/material";
import type { Metadata } from "next";
import { StealthCodeBanner } from "@/components/features/workspace/stealth-code-banner";
import { WorkspaceView } from "@/components/features/workspace/workspace-view";
import { PageHeader } from "@/components/ui/layout";

export const metadata: Metadata = { title: "Workspace" };

export default function WorkspacePage(): ReactElement {
  return (
    <Container
      maxWidth="xl"
      sx={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}
    >
      <PageHeader eyebrow="Workspace" title="Workspace" />
      <WorkspaceView />
      <StealthCodeBanner />
    </Container>
  );
}
