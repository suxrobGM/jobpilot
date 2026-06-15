import type { ReactElement } from "react";
import { Stack } from "@mui/material";
import {
  AddUrlsButton,
  CampaignLauncherButton,
  PipelineActionsProvider,
  PipelineFilterBar,
  PipelineHeaderStats,
  PipelineWorkspace,
} from "@/components/features/pipeline";
import { PageHeader } from "@/components/ui/layout";

export default function PipelinePage(): ReactElement {
  return (
    <PipelineActionsProvider>
      <Stack sx={{ flex: 1, minHeight: 0 }}>
        <Stack sx={{ paddingInline: 2.5 }}>
          <PageHeader
            eyebrow="Workspace"
            title="Pipeline"
            description={<PipelineHeaderStats />}
            actions={
              <>
                <AddUrlsButton />
                <CampaignLauncherButton />
              </>
            }
          />
          <PipelineFilterBar />
        </Stack>

        <PipelineWorkspace />
      </Stack>
    </PipelineActionsProvider>
  );
}
