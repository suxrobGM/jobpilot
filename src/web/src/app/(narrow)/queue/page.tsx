import type { ReactElement } from "react";
import { Stack } from "@mui/material";
import { QueueAddUrlsButton, QueueContent, QueueRunButton } from "@/components/features/queue";
import { PageHeader } from "@/components/ui/layout";

export default function QueuePage(): ReactElement {
  return (
    <Stack spacing={2}>
      <PageHeader
        eyebrow="Queue"
        title="Apply queue"
        description="Job URLs the apply skill will visit, score, and apply to. Add as many as you like; the skill drains them on its next run."
        actions={
          <Stack direction="row" spacing={1}>
            <QueueAddUrlsButton />
            <QueueRunButton />
          </Stack>
        }
      />
      <QueueContent />
    </Stack>
  );
}
