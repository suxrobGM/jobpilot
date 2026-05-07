import type { ReactElement } from "react";
import { Container, Stack } from "@mui/material";
import { RunsContent } from "@/components/features/runs/runs-content";
import { PageHeader } from "@/components/ui/layout/page-header";

export default function RunsPage(): ReactElement {
  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Stack spacing={2}>
        <PageHeader
          eyebrow="History"
          title="Runs"
          description="Autopilot and apply-batch runs. Click a row for the live viewer."
        />
        <RunsContent />
      </Stack>
    </Container>
  );
}
