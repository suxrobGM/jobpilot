import type { ReactElement } from "react";
import { Container } from "@mui/material";
import { CoverLettersTable } from "@/components/features/cover-letters";
import { PageHeader } from "@/components/ui/layout";

export default function CoverLettersPage(): ReactElement {
  return (
    <Container maxWidth="lg" sx={{ gap: 2 }}>
      <PageHeader
        eyebrow="Cover Letters"
        title="History"
        description="Cover letters generated during applications. Click a row to review the full text, download a PDF, or delete it."
      />
      <CoverLettersTable />
    </Container>
  );
}
