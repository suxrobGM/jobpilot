import type { ReactElement } from "react";
import { Download } from "@mui/icons-material";
import { Button, Stack } from "@mui/material";
import { ApplicationsContent } from "@/components/features/applications";
import { PageHeader } from "@/components/ui/layout/page-header";

export default function ApplicationsPage(): ReactElement {
  return (
    <Stack spacing={2}>
      <PageHeader
        eyebrow="History"
        title="Applications"
        description="Every job you've applied to. Filter by stage, board, source, or text."
        actions={
          <Button
            startIcon={<Download fontSize="md" />}
            variant="outlined"
            component="a"
            href="/api/applied/export.csv"
          >
            Export CSV
          </Button>
        }
      />
      <ApplicationsContent />
    </Stack>
  );
}
