import { Download } from "@mui/icons-material";
import { Button } from "@mui/material";
import type { ReactElement } from "react";
import { ApplicationsContent } from "@/components/features/applications/applications-content";
import { PageHeader } from "@/components/ui/layout/page-header";
import { PageShell } from "@/components/ui/layout/page-shell";

export default function ApplicationsPage(): ReactElement {
  return (
    <PageShell maxWidth="xl" spacing={2}>
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
    </PageShell>
  );
}
