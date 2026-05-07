import { Container, Stack } from "@mui/material";
import type { ReactElement } from "react";
import { DashboardContent } from "@/components/features/dashboard/dashboard-content";
import { PageHeader } from "@/components/ui/layout/page-header";

export default function HomePage(): ReactElement {
  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Stack spacing={3}>
        <PageHeader
          eyebrow="JobPilot"
          title="Dashboard"
          description="Snapshot of your job search across every board and skill."
        />
        <DashboardContent />
      </Stack>
    </Container>
  );
}
