import type { ReactElement } from "react";
import { Container } from "@mui/material";
import { ProfileEnhancer } from "@/components/features/upwork";
import { PageHeader } from "@/components/ui/layout";

export default function UpworkProfilePage(): ReactElement {
  return (
    <Container maxWidth="lg" sx={{ gap: 2 }}>
      <PageHeader
        eyebrow="Upwork"
        title="Profile enhancement"
        description="Sharpen your Upwork overview and portfolio from your résumé, then push the approved version to your live profile."
        backHref="/upwork"
        backLabel="Proposals"
      />
      <ProfileEnhancer />
    </Container>
  );
}
