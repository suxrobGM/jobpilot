import type { ReactElement } from "react";
import { OnboardingWizard } from "@/components/features/onboarding/onboarding-wizard";
import { PageHeader } from "@/components/ui/layout/page-header";
import { PageShell } from "@/components/ui/layout/page-shell";

export default function OnboardingPage(): ReactElement {
  return (
    <PageShell>
      <PageHeader
        eyebrow="First run"
        title="Welcome to JobPilot"
        description="Fill in your profile so skills can autofill applications. You can edit anything later from the profile page."
      />
      <OnboardingWizard />
    </PageShell>
  );
}
