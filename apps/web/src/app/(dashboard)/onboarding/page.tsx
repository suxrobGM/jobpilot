import type { ReactElement } from "react";
import { Container } from "@mui/material";
import { OnboardingWizard } from "@/components/features/onboarding";
import { PageHeader } from "@/components/ui/layout/page-header";

interface OnboardingPageProps {
  searchParams: Promise<{ new?: string }>;
}

export default async function OnboardingPage(props: OnboardingPageProps): Promise<ReactElement> {
  const { new: isNewParam } = await props.searchParams;
  const isNewProfile = isNewParam === "1";

  return (
    <Container maxWidth="md" sx={{ gap: 2 }}>
      <PageHeader
        eyebrow={isNewProfile ? "New profile" : "First run"}
        title={isNewProfile ? "Add a profile" : "Welcome to JobPilot"}
        description="Fill in your profile so skills can autofill applications. You can edit anything later from the profile page."
      />
      <OnboardingWizard isNewProfile={isNewProfile} />
    </Container>
  );
}
