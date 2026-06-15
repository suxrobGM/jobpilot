import type { ReactElement } from "react";
import { Container } from "@mui/material";
import { SettingsContent } from "@/components/features/settings";
import { PageHeader } from "@/components/ui/layout/page-header";

export default function SettingsPage(): ReactElement {
  return (
    <Container maxWidth="md" sx={{ gap: 2 }}>
      <PageHeader
        eyebrow="Account"
        title="Settings"
        description="Profile, work auth, auto-apply, email, and saved credentials."
      />
      <SettingsContent />
    </Container>
  );
}
