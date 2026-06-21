import type { ReactElement, ReactNode } from "react";
import { Container } from "@mui/material";
import { SettingsTabs } from "@/components/features/settings/settings-tabs";
import { PageHeader } from "@/components/ui/layout/page-header";

interface SettingsLayoutProps {
  children: ReactNode;
}

export default function SettingsLayout(props: SettingsLayoutProps): ReactElement {
  const { children } = props;
  return (
    <Container maxWidth="md">
      <PageHeader
        eyebrow="Account"
        title="Settings"
        description="Profile, work auth, auto-apply, email, and saved credentials."
      />
      <SettingsTabs />
      {children}
    </Container>
  );
}
