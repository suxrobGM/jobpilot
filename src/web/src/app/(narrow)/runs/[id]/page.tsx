import type { ReactElement } from "react";
import { Stack } from "@mui/material";
import { RunLiveViewer } from "@/components/features/runs";
import { PageHeader } from "@/components/ui/layout";

interface RunDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function RunDetailPage(props: RunDetailPageProps): Promise<ReactElement> {
  const { id } = await props.params;
  return (
    <Stack spacing={3}>
      <PageHeader eyebrow="Run" title={id} />
      <RunLiveViewer runId={id} />
    </Stack>
  );
}
