import { Container, Stack } from "@mui/material";
import type { ReactElement } from "react";
import { RunLiveViewer } from "@/components/features/runs/run-live-viewer";
import { PageHeader } from "@/components/ui/layout/page-header";

interface RunDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function RunDetailPage(
  props: RunDetailPageProps,
): Promise<ReactElement> {
  const { id } = await props.params;
  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Stack spacing={3}>
        <PageHeader eyebrow="Run" title={id} />
        <RunLiveViewer runId={id} />
      </Stack>
    </Container>
  );
}
