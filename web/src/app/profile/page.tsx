import type { ReactElement } from "react";
import { ProfileContent } from "@/components/features/profile/profile-content";
import { PageHeader } from "@/components/ui/layout/page-header";
import { PageShell } from "@/components/ui/layout/page-shell";

export default function ProfilePage(): ReactElement {
  return (
    <PageShell>
      <PageHeader
        eyebrow="Settings"
        title="Profile"
        description="Edit personal info, address, work authorization, EEO answers, autopilot defaults, login credentials, and resumes."
      />
      <ProfileContent />
    </PageShell>
  );
}
