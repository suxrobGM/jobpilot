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
        description="Profile, email, notifications, credentials, job boards, sign-in security, and how the pilot runs."
      />
      <SettingsTabs />
      {children}
    </PageShell>
  );
}
