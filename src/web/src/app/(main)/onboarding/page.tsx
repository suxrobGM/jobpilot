import type { ReactElement } from "react";
import { Stack } from "@mui/material";
import { OnboardingWizard } from "@/components/features/onboarding";
import { PageHeader } from "@/components/ui/layout/page-header";

export default function OnboardingPage(): ReactElement {
  return (
    <Stack spacing={3}>
      <PageHeader
        eyebrow="First run"
        title="Welcome to JobPilot"
        description="Fill in your profile so skills can autofill applications. You can edit anything later from the profile page."
      />
      <OnboardingWizard />
    </Stack>
  );
}
