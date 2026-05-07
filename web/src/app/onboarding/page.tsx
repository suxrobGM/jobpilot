import { Container, Stack } from "@mui/material";
import type { ReactElement } from "react";
import { OnboardingWizard } from "@/components/features/onboarding/onboarding-wizard";
import { PageHeader } from "@/components/ui/layout/page-header";

export default function OnboardingPage(): ReactElement {
  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Stack spacing={3}>
        <PageHeader
          eyebrow="First run"
          title="Welcome to JobPilot"
          description="Fill in your profile so skills can autofill applications. You can edit anything later from the profile page."
        />
        <OnboardingWizard />
      </Stack>
    </Container>
  );
}
