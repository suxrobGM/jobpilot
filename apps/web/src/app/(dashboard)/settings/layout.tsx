import type { ReactElement, ReactNode } from "react";
import { SettingsTabs } from "@/components/features/settings/settings-tabs";
import { PageHeader, PageShell } from "@/components/ui/layout";

interface SettingsLayoutProps {
  children: ReactNode;
}

export default function SettingsLayout(props: SettingsLayoutProps): ReactElement {
  const { children } = props;
  return (
    <PageShell maxWidth="md">
      <PageHeader
        eyebrow="Account"
        title="Settings"
        description="Profile, work auth, auto-apply, email, notifications, and saved credentials."
      />
      <SettingsTabs />
      {children}
    </PageShell>
  );
}
