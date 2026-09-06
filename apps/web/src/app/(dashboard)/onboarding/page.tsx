import type { ReactElement } from "react";
import type { Metadata } from "next";
import { OnboardingWizard } from "@/components/features/onboarding/onboarding-wizard";
import { PageHeader, PageShell } from "@/components/ui/layout";

export const metadata: Metadata = { title: "Onboarding" };

export default function OnboardingPage(): ReactElement {
  return (
    <PageShell maxWidth="md">
      <PageHeader
        eyebrow="First run"
        title="Welcome to JobPilot"
        description="Fill in your profile so skills can autofill applications, then optionally connect email and add job-board credentials. You can edit anything later in Settings."
      />
      <OnboardingWizard />
    </PageShell>
  );
}
