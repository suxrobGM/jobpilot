import type { ReactElement, ReactNode } from "react";
import { SettingsTabs } from "@/components/features/settings";
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
        description="Profile, work auth, auto-apply, email, notifications, credentials, and sign-in security."
      />
      <SettingsTabs />
      {children}
    </PageShell>
  );
}
