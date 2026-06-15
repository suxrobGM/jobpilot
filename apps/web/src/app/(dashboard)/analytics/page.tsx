import type { ReactElement } from "react";
import { Container } from "@mui/material";
import { AnalyticsView } from "@/components/features/analytics";
import { PageHeader } from "@/components/ui/layout";

export default function AnalyticsPage(): ReactElement {
  return (
    <Container maxWidth="xl" sx={{ gap: 2 }}>
      <PageHeader
        eyebrow="Workspace"
        title="Analytics"
        description="Roll-up stats across your applications, campaigns, and pipeline."
      />
      <AnalyticsView />
    </Container>
  );
}
