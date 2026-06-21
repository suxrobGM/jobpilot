import type { ReactElement } from "react";
import { Container } from "@mui/material";
import { OnboardingWizard } from "@/components/features/onboarding";
import { PageHeader } from "@/components/ui/layout/page-header";

export default function OnboardingPage(): ReactElement {
  return (
    <Container maxWidth="md" sx={{ gap: 2 }}>
      <PageHeader
        eyebrow="First run"
        title="Welcome to JobPilot"
        description="Fill in your profile so skills can autofill applications, then optionally connect email and add job-board credentials. You can edit anything later in Settings."
      />
      <OnboardingWizard />
    </Container>
  );
}
